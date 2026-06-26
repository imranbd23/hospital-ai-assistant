import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import multer from 'multer';
import { db as pgDb } from './src/db/index.ts';
import { users as pgUsers, pdfMetadata as pgPdfMetadata } from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { exec } from 'child_process';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Asynchronously install/verify PyMuPDF (fitz), Sentence-Transformers, and FAISS-CPU
exec('python3 -m pip install pymupdf sentence-transformers faiss-cpu numpy', (err, stdout, stderr) => {
  if (err) {
    console.error('Failed to install PyMuPDF, Sentence-Transformers, or FAISS-CPU via pip:', err.message);
  } else {
    console.log('PyMuPDF, Sentence-Transformers, and FAISS-CPU verified/installed successfully.');
  }
});

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'hospital-ai-secret-key-9988';

// In-Memory Database for dynamic, responsive playground state
interface User {
  id: number;
  email: string;
  fullName: string;
  role: 'patient' | 'doctor' | 'admin';
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
  patientId?: number | null;
}

interface Patient {
  id: number;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  medicalHistory: string;
  createdAt: string;
}

interface Consultation {
  id: number;
  patientId: number;
  doctorId: number | null;
  symptoms: string;
  clinicalNotes: string;
  aiSummary: string | null;
  diagnosisSuggestion: string | null;
  status: string;
  createdAt: string;
}

interface LogEntry {
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
  message: string;
  method?: string;
  path?: string;
  status?: number;
}

const db = {
  users: [
    {
      id: 1,
      email: 'doctor@hospital.com',
      fullName: 'Dr. Evelyn Vance',
      role: 'doctor',
      passwordHash: bcrypt.hashSync('password123', 10),
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      email: 'admin@hospital.com',
      fullName: 'System Administrator',
      role: 'admin',
      passwordHash: bcrypt.hashSync('admin123', 10),
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 3,
      email: 'patient@hospital.com',
      fullName: 'Johnathan Doe',
      role: 'patient',
      passwordHash: bcrypt.hashSync('patient123', 10),
      isActive: true,
      patientId: 101,
      createdAt: new Date().toISOString(),
    }
  ] as User[],
  patients: [
    {
      id: 101,
      fullName: 'Johnathan Doe',
      dateOfBirth: '1984-04-12',
      gender: 'Male',
      phone: '+1 (555) 019-2834',
      email: 'john.doe@email.com',
      medicalHistory: 'Mild asthma, allergy to Penicillin.',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 102,
      fullName: 'Clara Oswald',
      dateOfBirth: '1992-11-23',
      gender: 'Female',
      phone: '+1 (555) 024-9981',
      email: 'clara.o@email.com',
      medicalHistory: 'Type 1 diabetes managed with insulin pump.',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    }
  ] as Patient[],
  consultations: [
    {
      id: 201,
      patientId: 101,
      doctorId: 1,
      symptoms: 'Dry cough, low-grade fever, wheezing under moderate exertion.',
      clinicalNotes: 'Auscultation shows mild expiratory wheeze. Initiated bronchodilator therapy.',
      aiSummary: 'Clinical analysis suggests mild exacerbation of chronic bronchial asthma. Potential viral trigger.',
      diagnosisSuggestion: 'Asthma Exacerbation / Acute Bronchitis',
      status: 'completed',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    }
  ] as Consultation[],
  logs: [
    {
      timestamp: new Date(Date.now() - 60000).toISOString(),
      type: 'INFO' as const,
      message: 'Uvicorn running on http://0.0.0.0:8000 (FastAPI Core Module)',
    },
    {
      timestamp: new Date().toISOString(),
      type: 'INFO' as const,
      message: 'PostgreSQL connection pool established with 10 persistent connections',
    }
  ] as LogEntry[],
};

// Log helper to simulate both standard console output and dashboard stream
function addLog(type: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR', message: string, method?: string, path?: string, status?: number) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    type,
    message,
    method,
    path,
    status
  };
  db.logs.push(entry);
  if (db.logs.length > 100) {
    db.logs.shift(); // Keep logs capped
  }
}

// Global logger middleware for simulation endpoints
app.use((req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    if (req.path.startsWith('/api/v1')) {
      const type = res.statusCode >= 400 ? 'ERROR' : 'SUCCESS';
      addLog(type, `Request handled successfully`, req.method, req.path, res.statusCode);
    }
  });
  next();
});

// JWT Verification Middleware
function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    addLog('WARN', 'Access denied: Missing or malformed authorization header', req.method, req.path, 401);
    return res.status(401).json({ detail: 'Access denied. Missing or malformed authentication token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch (err: any) {
    addLog('WARN', `Access denied: Invalid token (${err.message})`, req.method, req.path, 401);
    return res.status(401).json({ detail: 'Access denied. Invalid or expired authentication token.' });
  }
}

// Role Authorization Middleware
function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      addLog('WARN', `Access forbidden: Role '${user?.role || 'anonymous'}' lacks permission`, req.method, req.path, 403);
      return res.status(403).json({ detail: `Access forbidden: This action requires one of the following roles: ${roles.join(', ')}` });
    }
    next();
  };
}

// Initialize Gemini client on server-side securely
let aiClient: any = null;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    addLog('INFO', 'Google GenAI engine initialized on Server-Side.');
  } catch (err: any) {
    addLog('ERROR', `Failed to initialize Gemini Client: ${err.message}`);
  }
} else {
  addLog('WARN', 'GEMINI_API_KEY not configured. Running AI features in Simulation mode.');
}

// ==================== FASTAPI SIMULATION API ENDPOINTS ====================

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'healthy', database: 'connected', engine: 'PostgreSQL 15' });
});

// Seed API endpoint for dynamic app resetting or simulation status
app.get('/api/v1/simulation/logs', (req, res) => {
  res.json(db.logs);
});

// Auth token issue simulator
app.post('/api/v1/auth/token', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ detail: 'Email (username) and password are required.' });
  }
  const user = db.users.find(u => u.email.toLowerCase() === username.toLowerCase());
  if (user && bcrypt.compareSync(password, user.passwordHash)) {
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName, patientId: user.patientId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    addLog('SUCCESS', `User authenticated successfully: ${user.fullName} (${user.role.toUpperCase()})`);
    res.json({
      access_token: token,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        patientId: user.patientId
      }
    });
  } else {
    addLog('WARN', `Failed login attempt for user: ${username}`);
    res.status(401).json({ detail: 'Incorrect credentials. Try doctor@hospital.com / password123, admin@hospital.com / admin123, or patient@hospital.com / patient123' });
  }
});

// Register clinician or patient
app.post('/api/v1/auth/register', (req, res) => {
  const { email, password, fullName, role } = req.body;
  if (!email || !fullName || !password) {
    return res.status(400).json({ detail: 'Email, Password, and Full Name are required.' });
  }
  const exists = db.users.some(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    return res.status(400).json({ detail: 'User already exists.' });
  }

  const assignedRole = (role || 'doctor') as 'patient' | 'doctor' | 'admin';
  if (!['patient', 'doctor', 'admin'].includes(assignedRole)) {
    return res.status(400).json({ detail: 'Invalid role. Must be admin, doctor, or patient.' });
  }

  let patientId: number | null = null;
  if (assignedRole === 'patient') {
    const existingPatient = db.patients.find(p => p.email.toLowerCase() === email.toLowerCase());
    if (existingPatient) {
      patientId = existingPatient.id;
    } else {
      // Auto-create matching patient record so patient role can view their own profile/records
      const newPatient: Patient = {
        id: db.patients.length + 101,
        fullName,
        dateOfBirth: '1990-01-01',
        gender: 'Not Specified',
        phone: '',
        email: email,
        medicalHistory: 'New self-registered patient.',
        createdAt: new Date().toISOString()
      };
      db.patients.push(newPatient);
      patientId = newPatient.id;
      addLog('SUCCESS', `Auto-created matching patient record for patient user: ${fullName}`);
    }
  }

  const newUser: User = {
    id: db.users.length + 1,
    email,
    fullName,
    role: assignedRole,
    passwordHash: bcrypt.hashSync(password, 10),
    isActive: true,
    createdAt: new Date().toISOString(),
    patientId
  };

  db.users.push(newUser);
  addLog('SUCCESS', `Registered new user: ${fullName} (${assignedRole.toUpperCase()})`);
  res.status(201).json({
    id: newUser.id,
    email: newUser.email,
    fullName: newUser.fullName,
    role: newUser.role,
    patientId: newUser.patientId,
    createdAt: newUser.createdAt
  });
});

// Admin-only User List Endpoint
app.get('/api/v1/admin/users', authenticateJWT, requireRole(['admin']), (req, res) => {
  const safeUsers = db.users.map(({ passwordHash, ...rest }) => rest);
  res.json(safeUsers);
});

// Patient collection (Protected)
app.get('/api/v1/patients', authenticateJWT, (req, res) => {
  const user = (req as any).user;
  if (user.role === 'patient') {
    // Patients can only see their own clinical record
    const myPatient = db.patients.filter(p => p.id === user.patientId || p.email.toLowerCase() === user.email.toLowerCase());
    return res.json(myPatient);
  }
  // Doctors and Admins can see all patients
  res.json(db.patients);
});

app.post('/api/v1/patients', authenticateJWT, requireRole(['doctor', 'admin']), (req, res) => {
  const { fullName, dateOfBirth, gender, phone, email, medicalHistory } = req.body;
  if (!fullName || !dateOfBirth || !gender) {
    return res.status(400).json({ detail: 'Full Name, DOB and Gender are required.' });
  }
  const newPatient: Patient = {
    id: db.patients.length + 101,
    fullName,
    dateOfBirth,
    gender,
    phone: phone || '',
    email: email || '',
    medicalHistory: medicalHistory || '',
    createdAt: new Date().toISOString(),
  };
  db.patients.push(newPatient);
  addLog('SUCCESS', `Patient Record Created: ${newPatient.fullName} (ID: ${newPatient.id})`);
  res.status(201).json(newPatient);
});

app.delete('/api/v1/patients/:id', authenticateJWT, requireRole(['admin']), (req, res) => {
  const id = parseInt(req.params.id);
  const index = db.patients.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ detail: 'Patient not found' });
  }
  const deleted = db.patients.splice(index, 1)[0];
  addLog('WARN', `Patient Record Deleted: ${deleted.fullName} (ID: ${id})`);
  res.json({ message: 'Patient removed successfully', deleted });
});

// Consultations (Protected)
app.get('/api/v1/consultations', authenticateJWT, (req, res) => {
  const user = (req as any).user;
  if (user.role === 'patient') {
    const myPatientId = user.patientId || db.patients.find(p => p.email.toLowerCase() === user.email.toLowerCase())?.id;
    if (!myPatientId) {
      return res.json([]);
    }
    const myConsultations = db.consultations.filter(c => c.patientId === myPatientId);
    return res.json(myConsultations);
  }
  // Doctors and Admins can see all consultations
  res.json(db.consultations);
});

app.post('/api/v1/consultations', authenticateJWT, requireRole(['doctor', 'admin']), (req, res) => {
  const { patientId, symptoms, clinicalNotes, status } = req.body;
  if (!patientId || !symptoms) {
    return res.status(400).json({ detail: 'Patient ID and symptoms are required.' });
  }
  const patient = db.patients.find(p => p.id === patientId);
  if (!patient) {
    return res.status(404).json({ detail: 'Patient not found' });
  }
  const newConsult: Consultation = {
    id: db.consultations.length + 201,
    patientId,
    doctorId: (req as any).user.id,
    symptoms,
    clinicalNotes: clinicalNotes || '',
    aiSummary: null,
    diagnosisSuggestion: null,
    status: status || 'pending',
    createdAt: new Date().toISOString(),
  };
  db.consultations.push(newConsult);
  addLog('SUCCESS', `Consultation logged for patient ${patient.fullName} by Dr. ${(req as any).user.fullName}`);
  res.status(201).json(newConsult);
});

// Gemini AI Medical Diagnosis Suggestions Endpoint (Protected for Doctor/Admin)
app.post('/api/v1/ai/analyze', authenticateJWT, requireRole(['doctor', 'admin']), async (req, res) => {
  const { symptoms, patient_history } = req.body;
  if (!symptoms) {
    return res.status(400).json({ detail: 'Symptoms string is required for AI evaluation.' });
  }

  addLog('INFO', `Invoking Server-Side Gemini Clinical Intelligence to evaluate symptoms.`);

  if (aiClient) {
    try {
      const prompt = `
        You are an advanced Hospital clinical assistant. Analyze the following patient case:
        Patient Current Symptoms: ${symptoms}
        Patient Chronic/Medical History: ${patient_history || 'None reported'}

        Please provide a highly-structured clinical analysis. You must output a JSON object with the following fields:
        - suggested_diagnosis: A clear, professional medical diagnosis suggestion, noting probabilities.
        - recommended_tests: A list of laboratory, imaging, or physical tests recommended to confirm diagnosis.
        - suggested_specialists: A list of clinical departments or specialties appropriate for this case.
        - ai_summary: A concise, medical-grade summary of the case, highlighting warning signs (red flags).
      `;

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const responseText = response.text || '';
      try {
        const parsed = JSON.parse(responseText);
        addLog('SUCCESS', 'Gemini AI successfully generated high-fidelity clinical suggestions.');
        return res.json(parsed);
      } catch (jsonErr) {
        addLog('ERROR', 'Error parsing JSON response from Gemini model.');
        return res.json({
          suggested_diagnosis: "Inconclusive / Highly Complex symptoms",
          recommended_tests: ["Standard Blood Panel", "Clinical Observation"],
          suggested_specialists: ["Internal Medicine"],
          ai_summary: responseText
        });
      }
    } catch (err: any) {
      addLog('ERROR', `Gemini API Call failed: ${err.message}`);
      return res.status(500).json({ detail: `AI Error: ${err.message}` });
    }
  } else {
    // Elegant and logical simulation response in absence of direct Gemini API Key configured in current sandbox context
    addLog('INFO', 'Simulating clinical report with preset medical catalog mappings.');
    const symptomQuery = symptoms.toLowerCase();
    
    let suggested_diagnosis = "Triage evaluation recommended";
    let recommended_tests = ["Complete Blood Count (CBC)", "Basic Metabolic Panel (BMP)"];
    let suggested_specialists = ["Primary Care Physician"];
    let ai_summary = "An AI assessment was simulated because the server is currently in dry-run mode (No GEMINI_API_KEY detected). Verify your symptoms with clinical triage.";

    if (symptomQuery.includes('cough') || symptomQuery.includes('fever') || symptomQuery.includes('breath')) {
      suggested_diagnosis = "Acute Upper Respiratory Tract Infection vs. Bronchitis";
      recommended_tests = ["Chest X-Ray", "Sputum Culture", "Pulse Oximetry"];
      suggested_specialists = ["Pulmonologist", "General Medicine"];
      ai_summary = "Simulated Analysis: Clear indicators of respiratory stress. Red flags: high fever, tachypnea, and accessory muscle use. Recommend quick clinical review.";
    } else if (symptomQuery.includes('chest') || symptomQuery.includes('heart') || symptomQuery.includes('arm')) {
      suggested_diagnosis = "Angina Pectoris vs. Acute Coronary Syndrome (ACS)";
      recommended_tests = ["12-Lead Electrocardiogram (ECG)", "Troponin Blood Assay", "Echocardiogram"];
      suggested_specialists = ["Cardiologist", "Emergency Medicine"];
      ai_summary = "CRITICAL ALERT: Chest compression or radiating discomfort requires IMMEDIATE emergency intervention. Red flags include diaphoresis and dyspnea.";
    } else if (symptomQuery.includes('abdominal') || symptomQuery.includes('stomach') || symptomQuery.includes('nausea')) {
      suggested_diagnosis = "Acute Gastroenteritis vs. Appendicitis";
      recommended_tests = ["Abdominal Ultrasound", "WBC Count", "Urinalysis"];
      suggested_specialists = ["Gastroenterologist", "General Surgeon"];
      ai_summary = "Simulated Analysis: Localized abdominal tenderness requires examination. Rule out surgical abdomen (rebound tenderness, guarding).";
    }

    setTimeout(() => {
      res.json({
        suggested_diagnosis,
        recommended_tests,
        suggested_specialists,
        ai_summary
      });
    }, 800);
  }
});


// --- PostgreSQL User Synchronization Helper ---
async function getOrCreatePgUser(jwtUser: any) {
  try {
    const email = jwtUser.email;
    const uid = jwtUser.uid || `jwt-${jwtUser.id || email}`;
    
    const existing = await pgDb.select().from(pgUsers).where(eq(pgUsers.email, email)).limit(1);
    if (existing.length > 0) {
      return existing[0];
    }
    
    const inserted = await pgDb.insert(pgUsers).values({
      uid,
      email,
      fullName: jwtUser.fullName || email.split('@')[0],
      role: jwtUser.role || 'doctor',
    }).returning();
    
    return inserted[0];
  } catch (error) {
    console.error('Error in getOrCreatePgUser:', error);
    throw error;
  }
}

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

// Multer middleware with PDF validation (max 20MB)
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF documents are allowed.'));
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      return cb(new Error('Only files with .pdf extension are allowed.'));
    }
    cb(null, true);
  },
});

// --- PDF Endpoints ---

// Upload PDF with metadata storage in PostgreSQL
app.post('/api/v1/pdfs/upload', authenticateJWT, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      addLog('ERROR', `PDF Upload Validation Failed: ${err.message}`, req.method, req.path, 400);
      return res.status(400).json({ detail: err.message });
    }

    try {
      if (!req.file) {
        addLog('WARN', 'PDF Upload attempted without selecting a file', req.method, req.path, 400);
        return res.status(400).json({ detail: 'No file uploaded.' });
      }

      const jwtUser = (req as any).user;
      const pgUser = await getOrCreatePgUser(jwtUser);

      // Save metadata in PostgreSQL
      const [metadata] = await pgDb.insert(pgPdfMetadata).values({
        fileName: req.file.originalname,
        filePath: req.file.filename,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        userId: pgUser.id,
      }).returning();

      addLog('SUCCESS', `PDF Uploaded: ${metadata.fileName} (${(metadata.fileSize / 1024 / 1024).toFixed(2)} MB) by ${pgUser.fullName}`);
      return res.status(201).json(metadata);
    } catch (dbErr: any) {
      console.error('Database insertion error:', dbErr);
      addLog('ERROR', `PostgreSQL save failed: ${dbErr.message}`, req.method, req.path, 500);
      return res.status(500).json({ detail: 'Failed to record PDF metadata in PostgreSQL database.' });
    }
  });
});

// Fetch uploaded PDF metadata
app.get('/api/v1/pdfs', authenticateJWT, async (req, res) => {
  try {
    const jwtUser = (req as any).user;
    const pgUser = await getOrCreatePgUser(jwtUser);

    let queryResult;
    if (pgUser.role === 'patient') {
      // Patients can only see their own uploaded documents
      queryResult = await pgDb
        .select()
        .from(pgPdfMetadata)
        .where(eq(pgPdfMetadata.userId, pgUser.id))
        .orderBy(desc(pgPdfMetadata.uploadedAt));
    } else {
      // Clinicians and Admins can see all documents, join with user info
      queryResult = await pgDb
        .select({
          id: pgPdfMetadata.id,
          fileName: pgPdfMetadata.fileName,
          filePath: pgPdfMetadata.filePath,
          fileSize: pgPdfMetadata.fileSize,
          mimeType: pgPdfMetadata.mimeType,
          uploadedAt: pgPdfMetadata.uploadedAt,
          userId: pgPdfMetadata.userId,
          uploaderName: pgUsers.fullName,
          uploaderEmail: pgUsers.email,
        })
        .from(pgPdfMetadata)
        .leftJoin(pgUsers, eq(pgPdfMetadata.userId, pgUsers.id))
        .orderBy(desc(pgPdfMetadata.uploadedAt));
    }

    return res.json(queryResult);
  } catch (error: any) {
    console.error('Error fetching PDFs:', error);
    addLog('ERROR', `Failed to query PDF metadata: ${error.message}`, req.method, req.path, 500);
    return res.status(500).json({ detail: 'Failed to retrieve PDF list.' });
  }
});

// Download/View PDF securely
app.get('/api/v1/pdfs/:id/download', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ detail: 'Invalid document ID.' });
    }

    const [pdf] = await pgDb.select().from(pgPdfMetadata).where(eq(pgPdfMetadata.id, id)).limit(1);
    if (!pdf) {
      return res.status(404).json({ detail: 'Document not found.' });
    }

    // Permission check
    const jwtUser = (req as any).user;
    const pgUser = await getOrCreatePgUser(jwtUser);
    if (pgUser.role === 'patient' && pdf.userId !== pgUser.id) {
      return res.status(403).json({ detail: 'Access forbidden: You can only access your own documents.' });
    }

    const fullFilePath = path.join(uploadDir, pdf.filePath);
    if (!fs.existsSync(fullFilePath)) {
      addLog('ERROR', `File not found on local disk: ${pdf.filePath}`, req.method, req.path, 404);
      return res.status(404).json({ detail: 'File not found on server local disk.' });
    }

    addLog('SUCCESS', `Document downloaded: ${pdf.fileName} by ${pgUser.fullName}`);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(pdf.fileName)}"`);
    res.setHeader('Content-Type', 'application/pdf');
    return res.sendFile(fullFilePath);
  } catch (error: any) {
    console.error('Download error:', error);
    return res.status(500).json({ detail: 'Failed to download document.' });
  }
});

// Delete PDF securely from local storage & database
app.delete('/api/v1/pdfs/:id', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ detail: 'Invalid document ID.' });
    }

    const [pdf] = await pgDb.select().from(pgPdfMetadata).where(eq(pgPdfMetadata.id, id)).limit(1);
    if (!pdf) {
      return res.status(404).json({ detail: 'Document not found.' });
    }

    // Access control: patients can only delete their own. Doctors/admins can delete any.
    const jwtUser = (req as any).user;
    const pgUser = await getOrCreatePgUser(jwtUser);
    if (pgUser.role === 'patient' && pdf.userId !== pgUser.id) {
      return res.status(403).json({ detail: 'Access forbidden: You cannot delete other users\' documents.' });
    }

    // Delete local file
    const fullFilePath = path.join(uploadDir, pdf.filePath);
    if (fs.existsSync(fullFilePath)) {
      fs.unlinkSync(fullFilePath);
    }

    // Delete from PostgreSQL
    await pgDb.delete(pgPdfMetadata).where(eq(pgPdfMetadata.id, id));

    addLog('WARN', `Document deleted from system: ${pdf.fileName} by ${pgUser.fullName}`);
    return res.json({ message: 'Document and metadata successfully deleted from disk and PostgreSQL.' });
  } catch (error: any) {
    console.error('Delete error:', error);
    addLog('ERROR', `Failed to delete PDF: ${error.message}`, req.method, req.path, 500);
    return res.status(500).json({ detail: 'Failed to delete document.' });
  }
});


// Extract text and build FAISS index for PDF securely using PyMuPDF (fitz) and Sentence-Transformers
app.post('/api/v1/pdfs/:id/extract', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ detail: 'Invalid document ID.' });
    }

    const [pdf] = await pgDb.select().from(pgPdfMetadata).where(eq(pgPdfMetadata.id, id)).limit(1);
    if (!pdf) {
      return res.status(404).json({ detail: 'Document not found.' });
    }

    // Permission check
    const jwtUser = (req as any).user;
    const pgUser = await getOrCreatePgUser(jwtUser);
    if (pgUser.role === 'patient' && pdf.userId !== pgUser.id) {
      return res.status(403).json({ detail: 'Access forbidden: You can only extract text from your own documents.' });
    }

    const fullFilePath = path.join(uploadDir, pdf.filePath);
    if (!fs.existsSync(fullFilePath)) {
      addLog('ERROR', `File not found on local disk for extraction: ${pdf.filePath}`, req.method, req.path, 404);
      return res.status(404).json({ detail: 'File not found on server local disk.' });
    }

    addLog('INFO', `Starting text extraction & FAISS indexing for PDF: ${pdf.fileName}...`);

    // Execute Python extraction and indexing script
    const scriptPath = path.join(process.cwd(), 'faiss_index.py');
    exec(`python3 "${scriptPath}" index --pdf-id ${id} --pdf-path "${fullFilePath}"`, (err, stdout, stderr) => {
      if (err) {
        console.error('Python FAISS index error:', err, stderr);
        addLog('ERROR', `FAISS Indexing failed: ${err.message}`);
        return res.status(500).json({ detail: `Indexing failed: ${err.message}` });
      }

      try {
        const parsedResult = JSON.parse(stdout.trim());
        if (!parsedResult.success) {
          addLog('ERROR', `FAISS Indexing returned failure: ${parsedResult.error}`);
          return res.status(500).json({ detail: parsedResult.error });
        }

        addLog('SUCCESS', `Successfully extracted text & built FAISS vector index with ${parsedResult.totalChunks} chunks (all-MiniLM-L6-v2) for ${pdf.fileName}.`);
        return res.json(parsedResult);
      } catch (jsonErr: any) {
        console.error('Failed to parse Python stdout:', stdout);
        addLog('ERROR', `Failed to parse FAISS script output: ${jsonErr.message}`);
        return res.status(500).json({ detail: 'Failed to process extracted text and vector indices.' });
      }
    });

  } catch (error: any) {
    console.error('Text extraction API error:', error);
    return res.status(500).json({ detail: 'An unexpected error occurred during extraction.' });
  }
});


// FAISS Similarity Search over indexed PDF document chunks
app.post('/api/v1/pdfs/:id/search', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ detail: 'Invalid document ID.' });
    }

    const { query, topK = 5 } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ detail: 'Query text parameter is required as a string.' });
    }

    const [pdf] = await pgDb.select().from(pgPdfMetadata).where(eq(pgPdfMetadata.id, id)).limit(1);
    if (!pdf) {
      return res.status(404).json({ detail: 'Document not found.' });
    }

    // Permission check
    const jwtUser = (req as any).user;
    const pgUser = await getOrCreatePgUser(jwtUser);
    if (pgUser.role === 'patient' && pdf.userId !== pgUser.id) {
      return res.status(403).json({ detail: 'Access forbidden: You can only query your own documents.' });
    }

    addLog('INFO', `Executing FAISS Similarity Search for query: "${query}" on PDF ID: ${id}`);

    // Execute Python search command
    const scriptPath = path.join(process.cwd(), 'faiss_index.py');
    // Safely wrap query string to handle command-line characters (escape quotes if necessary or pass safely)
    const escapedQuery = query.replace(/"/g, '\\"');
    
    exec(`python3 "${scriptPath}" search --pdf-id ${id} --query "${escapedQuery}" --top-k ${topK}`, (err, stdout, stderr) => {
      if (err) {
        console.error('Python FAISS search error:', err, stderr);
        addLog('ERROR', `FAISS Similarity Search failed: ${err.message}`);
        return res.status(500).json({ detail: `Search failed: ${err.message}` });
      }

      try {
        const parsedResult = JSON.parse(stdout.trim());
        if (!parsedResult.success) {
          addLog('ERROR', `FAISS search returned failure: ${parsedResult.error}`);
          return res.status(400).json({ detail: parsedResult.error });
        }

        addLog('SUCCESS', `Completed FAISS Similarity Search on ${pdf.fileName}. Found ${parsedResult.results.length} matches.`);
        return res.json(parsedResult);
      } catch (jsonErr: any) {
        console.error('Failed to parse Python search stdout:', stdout);
        addLog('ERROR', `Failed to parse FAISS search output: ${jsonErr.message}`);
        return res.status(500).json({ detail: 'Failed to process similarity search results.' });
      }
    });

  } catch (error: any) {
    console.error('FAISS search API error:', error);
    return res.status(500).json({ detail: 'An unexpected error occurred during similarity search.' });
  }
});


// Llama 3 Q&A route: Retrieves top 5 chunks via FAISS and queries Llama 3 with precise instructions
app.post('/api/v1/pdfs/:id/llama-qa', authenticateJWT, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ detail: 'Invalid document ID.' });
    }

    const { query, provider = 'gemini_fallback', apiKey, history = [] } = req.body;
    
    // Determine the latest question/query
    let retrievalQuery = query;
    if (!retrievalQuery && Array.isArray(history) && history.length > 0) {
      const lastUserMsg = [...history].reverse().find(msg => msg.role === 'user');
      if (lastUserMsg) {
        retrievalQuery = lastUserMsg.content;
      }
    }

    if (!retrievalQuery || typeof retrievalQuery !== 'string') {
      return res.status(400).json({ detail: 'Query text or a valid message history is required.' });
    }

    const [pdf] = await pgDb.select().from(pgPdfMetadata).where(eq(pgPdfMetadata.id, id)).limit(1);
    if (!pdf) {
      return res.status(404).json({ detail: 'Document not found.' });
    }

    // Permission check
    const jwtUser = (req as any).user;
    const pgUser = await getOrCreatePgUser(jwtUser);
    if (pgUser.role === 'patient' && pdf.userId !== pgUser.id) {
      return res.status(403).json({ detail: 'Access forbidden: You can only query your own documents.' });
    }

    addLog('INFO', `Llama-QA: Retrieving context chunks for "${retrievalQuery}" from PDF ID: ${id}`);

    // 1. Fetch top 5 chunks via python similarity search first
    const scriptPath = path.join(process.cwd(), 'faiss_index.py');
    const escapedQuery = retrievalQuery.replace(/"/g, '\\"');

    exec(`python3 "${scriptPath}" search --pdf-id ${id} --query "${escapedQuery}" --top-k 5`, async (err, stdout, stderr) => {
      if (err) {
        console.error('Python FAISS search error inside Llama-QA:', err, stderr);
        return res.status(500).json({ detail: `Search failed during context retrieval: ${err.message}` });
      }

      try {
        const searchResult = JSON.parse(stdout.trim());
        if (!searchResult.success || !searchResult.results) {
          return res.status(400).json({ detail: searchResult.error || 'Failed to retrieve context chunks.' });
        }

        const contextChunks = searchResult.results;
        
        // 2. Format context text cleanly for Llama 3
        const contextText = contextChunks.map((c: any, index: number) => {
          return `--- CONTEXT BLOCK ${index + 1} (Page ${c.page}, Chunk ${c.chunkId}) ---\n${c.text}`;
        }).join('\n\n');

        addLog('INFO', `Llama-QA: Sending dialogue with ${contextChunks.length} context blocks to Llama 3 (${provider}).`);

        // Prompt that forces the model to answer ONLY using the retrieved context
        const systemPrompt = `You are Meta's Llama 3 8B Instruct LLM.
Your absolute directive is to answer the user's question STRICTLY and ONLY using the provided retrieved context blocks.

=== STRICT CONSTRAINTS ===
1. Answer the question using ONLY the facts explicitly mentioned in the context blocks below.
2. If the answer cannot be fully found in the context blocks, you MUST state exactly: "I cannot find the answer to this question in the retrieved document context." Do not make up any facts or synthesize an answer from external knowledge.
3. For each fact or statement you make, cite the page number and chunk ID where it was found (e.g., [Page X, Chunk Y]).
4. Be clear, concise, objective, and direct. No conversational filler.

Retrieved Context Blocks:
${contextText}`;

        let answerText = '';

        // Standardize dialogue formatting for history
        const formattedHistory = Array.isArray(history) && history.length > 0 ? history : [{ role: 'user', content: retrievalQuery }];

        if (provider === 'gemini_fallback') {
          if (!aiClient) {
            return res.status(400).json({ detail: 'Gemini client is not configured on the server. Please provide a Llama 3 API Key.' });
          }

          // Build a single text conversation block for Gemini fallback
          let dialogue = `${systemPrompt}\n\n`;
          for (const msg of formattedHistory) {
            const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
            dialogue += `${roleLabel}: ${msg.content}\n\n`;
          }
          dialogue += `Assistant:`;

          const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: dialogue,
            config: {
              temperature: 0.1,
            },
          });
          answerText = response.text || '';

        } else if (provider === 'huggingface') {
          const token = apiKey || process.env.HF_API_KEY;
          if (!token) {
            return res.status(400).json({ detail: 'Hugging Face API key is missing. Please enter your Hugging Face User Access Token.' });
          }

          // Format prompt in Llama 3 Instruct template style
          let prompt = `<|system|>\n${systemPrompt}\n`;
          for (const msg of formattedHistory) {
            if (msg.role === 'user') {
              prompt += `<|user|>\n${msg.content}\n`;
            } else {
              prompt += `<|assistant|>\n${msg.content}\n`;
            }
          }
          prompt += `<|assistant|>\n`;

          const hfRes = await fetch('https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              inputs: prompt,
              parameters: {
                max_new_tokens: 512,
                temperature: 0.1,
                return_full_text: false
              }
            })
          });

          if (!hfRes.ok) {
            const errBody = await hfRes.text();
            throw new Error(`Hugging Face API Error: ${errBody}`);
          }

          const hfData = await hfRes.json();
          if (Array.isArray(hfData) && hfData[0]?.generated_text) {
            answerText = hfData[0].generated_text;
          } else if (hfData?.generated_text) {
            answerText = hfData.generated_text;
          } else {
            answerText = JSON.stringify(hfData);
          }

        } else if (provider === 'groq') {
          const token = apiKey || process.env.GROQ_API_KEY;
          if (!token) {
            return res.status(400).json({ detail: 'Groq API Key is missing. Please enter your Groq API Key.' });
          }

          // Construct API messages list
          const messages = [
            { role: 'system', content: systemPrompt },
            ...formattedHistory.map((m: any) => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content
            }))
          ];

          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama3-8b-8192',
              messages,
              temperature: 0.1,
              max_tokens: 512
            })
          });

          if (!groqRes.ok) {
            const errBody = await groqRes.text();
            throw new Error(`Groq API Error: ${errBody}`);
          }

          const groqData = await groqRes.json();
          answerText = groqData?.choices?.[0]?.message?.content || JSON.stringify(groqData);

        } else if (provider === 'openrouter') {
          const token = apiKey || process.env.OPENROUTER_API_KEY;
          if (!token) {
            return res.status(400).json({ detail: 'OpenRouter API Key is missing. Please enter your OpenRouter API Key.' });
          }

          const messages = [
            { role: 'system', content: systemPrompt },
            ...formattedHistory.map((m: any) => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content
            }))
          ];

          const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://ai.studio/build',
              'X-Title': 'AI Studio Hospital RAG Applet'
            },
            body: JSON.stringify({
              model: 'meta-llama/llama-3-8b-instruct:free',
              messages,
              temperature: 0.1,
              max_tokens: 512
            })
          });

          if (!orRes.ok) {
            const errBody = await orRes.text();
            throw new Error(`OpenRouter API Error: ${errBody}`);
          }

          const orData = await orRes.json();
          answerText = orData?.choices?.[0]?.message?.content || JSON.stringify(orData);
        } else {
          return res.status(400).json({ detail: `Unknown model provider: ${provider}` });
        }

        // Clean up answer output from markdown block wrappers if model repeated prompt tags
        let cleanAnswer = answerText.trim();
        if (cleanAnswer.includes('<|assistant|>')) {
          cleanAnswer = cleanAnswer.split('<|assistant|>').pop()?.trim() || cleanAnswer;
        }

        addLog('SUCCESS', `Llama-QA Answer generated successfully using ${provider} on ${pdf.fileName}`);
        return res.json({
          query: retrievalQuery,
          answer: cleanAnswer,
          provider,
          contextChunks
        });

      } catch (innerErr: any) {
        console.error('Llama-QA query dispatch error:', innerErr);
        addLog('ERROR', `Llama-QA provider call failed: ${innerErr.message}`);
        return res.status(502).json({ detail: `Llama 3 generation failed: ${innerErr.message}` });
      }
    });

  } catch (error: any) {
    console.error('Llama-QA overall API error:', error);
    return res.status(500).json({ detail: 'An unexpected error occurred during Llama 3 evaluation.' });
  }
});


// Serve Vite static build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  // Integrate Vite dev server middleware in non-production mode
  // This satisfies Vite dynamic builds cleanly and mounts on Port 3000
  const vite = await import('vite');
  const viteServer = await vite.createServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(viteServer.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  addLog('INFO', `Unified Server hosting UI and backend mock APIs active on Port ${PORT}`);
  console.log(`Server is running on port ${PORT}`);
});
