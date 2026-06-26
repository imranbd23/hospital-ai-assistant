import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import {
  Folder,
  File,
  Terminal,
  Activity,
  UserCheck,
  Cpu,
  Layers,
  Database,
  RefreshCw,
  Plus,
  Play,
  CheckCircle2,
  Trash2,
  Shield,
  ShieldAlert,
  User,
  FileText,
  Clock,
  ExternalLink,
  Lock,
  ChevronRight,
  Sparkles,
  Search,
  Check,
  Eye,
  BookOpen
} from 'lucide-react';

// Codebase file tree and static source viewer
interface SourceFile {
  name: string;
  path: string;
  content: string;
  language: 'python' | 'docker' | 'yaml' | 'ini' | 'text';
}

const BACKEND_FILES: SourceFile[] = [
  {
    name: 'main.py',
    path: 'app/main.py',
    language: 'python',
    content: `from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List

from app.core.config import settings
from app.core.database import Base, engine, get_db
from app.models.all_models import User, Patient, Consultation, MedicalRecord
from app.schemas.all_schemas import Token, UserCreate, UserResponse, PatientCreate, PatientResponse
from app.crud.all_crud import user_crud, patient_crud
from app.core.security import create_access_token, verify_token
from app.services.gemini import clinical_ai

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")

# Secured route using JWT authentication
@app.post("/api/v1/patients", response_model=PatientResponse)
def create_patient(patient_in: PatientCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return patient_crud.create(db, obj_in=patient_in)

@app.post("/api/v1/ai/analyze")
def analyze_symptoms(request: AIConsultRequest, current_user: User = Depends(get_current_user)):
    analysis = clinical_ai.analyze_symptoms(symptoms=request.symptoms, patient_history=request.patient_history)
    return analysis`
  },
  {
    name: 'config.py',
    path: 'app/core/config.py',
    language: 'python',
    content: `from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Hospital AI Assistant API"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "postgresql://hospital_admin:password123@localhost:5432/hospital_ai"
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    GEMINI_API_KEY: str

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env")

settings = Settings()`
  },
  {
    name: 'security.py',
    path: 'app/core/security.py',
    language: 'python',
    content: `from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(subject: str, expires_delta: timedelta = None) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    return jwt.encode({"exp": expire, "sub": str(subject)}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)`
  },
  {
    name: 'all_models.py',
    path: 'app/models/all_models.py',
    language: 'python',
    content: `from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    DOCTOR = "doctor"
    NURSE = "nurse"

class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(255), nullable=False)
    date_of_birth = Column(String(50), nullable=False)
    gender = Column(String(50), nullable=False)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), unique=True, index=True)
    medical_history = Column(Text, nullable=True)
    
    consultations = relationship("Consultation", back_populates="patient")`
  },
  {
    name: 'gemini.py',
    path: 'app/services/gemini.py',
    language: 'python',
    content: `from google import genai
from google.genai import types
from app.core.config import settings

class ClinicalAIService:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    def analyze_symptoms(self, symptoms: str, patient_history: str = None):
        prompt = f"Analyze patient case: Symptoms: {symptoms}, History: {patient_history}"
        response = self.client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            )
        )
        return response.text`
  },
  {
    name: 'Dockerfile',
    path: 'Dockerfile',
    language: 'docker',
    content: `FROM python:3.11-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim as runner
WORKDIR /app
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`
  },
  {
    name: 'docker-compose.yml',
    path: 'docker-compose.yml',
    language: 'yaml',
    content: `version: "3.8"
services:
  db:
    image: postgres:15-alpine
    container_name: hospital_db
    environment:
      POSTGRES_USER: hospital_admin
      POSTGRES_PASSWORD: password123
      POSTGRES_DB: hospital_ai
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  web:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://hospital_admin:password123@db:5432/hospital_ai
      - SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7
    depends_on:
      - db`
  },
  {
    name: 'requirements.txt',
    path: 'requirements.txt',
    language: 'text',
    content: `fastapi>=0.110.0
uvicorn[standard]>=0.28.0
sqlalchemy>=2.0.28
psycopg2-binary>=2.9.9
pydantic[email]>=2.6.4
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
alembic>=1.13.1
google-genai>=2.4.0`
  }
];

interface Endpoint {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  path: string;
  desc: string;
  latency: number;
}

const ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/api/v1/auth/token', desc: 'Acquire JWT access token', latency: 15 },
  { method: 'GET', path: '/api/v1/patients', desc: 'List patient medical profiles', latency: 22 },
  { method: 'POST', path: '/api/v1/patients', desc: 'Register a new patient record', latency: 31 },
  { method: 'POST', path: '/api/v1/ai/analyze', desc: 'Request server-side Gemini analysis', latency: 450 },
  { method: 'GET', path: '/api/v1/health', desc: 'FastAPI container state probe', latency: 8 },
];

const ChatMessageItem = ({ msg, showToast }: { msg: any; showToast: any }) => {
  const [sourcesExpanded, setSourcesExpanded] = React.useState(false);

  return (
    <div className="flex items-start gap-2.5 max-w-[95%] select-text w-full">
      <div className="w-7 h-7 rounded-full bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400 shrink-0 text-xs">
        🦙
      </div>
      <div className="bg-[#161b22] border border-[#30363D] rounded-2xl rounded-tl-none px-4 py-3 text-xs leading-relaxed text-[#C9D1D9] shadow-sm flex flex-col gap-2.5 w-full">
        {/* Markdown rendering with proper typography */}
        <div className="text-[#C9D1D9] text-xs leading-relaxed space-y-2 max-w-none break-words">
          <Markdown>{msg.content}</Markdown>
        </div>

        {/* Source References Drawer */}
        {msg.contextChunks && msg.contextChunks.length > 0 && (
          <div className="mt-1 pt-2 border-t border-[#30363D]/40">
            <button
              onClick={() => setSourcesExpanded(!sourcesExpanded)}
              className="flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              <Search size={9} />
              <span>{sourcesExpanded ? 'Hide' : 'Show'} Sources Consulted ({msg.contextChunks.length})</span>
            </button>
            
            {sourcesExpanded && (
              <div className="mt-2 space-y-2 animate-fade-in max-h-[160px] overflow-y-auto pr-1">
                {msg.contextChunks.map((resObj: any, idx: number) => (
                  <div key={idx} className="bg-[#0D1117] border border-[#30363D]/75 rounded-lg overflow-hidden flex flex-col text-[10px]">
                    <div className="flex items-center justify-between px-2 py-1 bg-[#161B22] border-b border-[#30363D]/50 text-[8px] font-mono text-[#8B949E]">
                      <span>
                        MATCH #{idx + 1} (Score: {resObj.similarityScore?.toFixed(4) || 'N/A'})
                      </span>
                      <span className="bg-[#30363D] px-1 rounded text-[#C9D1D9]">
                        Page {resObj.page} • Chunk {resObj.chunkId}
                      </span>
                    </div>
                    <div className="p-2 font-mono text-[9px] text-[#8B949E] whitespace-pre-wrap leading-relaxed bg-[#0D1117]/40 select-text">
                      {resObj.text}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [selectedFile, setSelectedFile] = useState<SourceFile>(BACKEND_FILES[0]);
  
  // Authentication states
  const [authToken, setAuthToken] = useState<string>('');
  const [username, setUsername] = useState<string>('doctor@hospital.com');
  const [password, setPassword] = useState<string>('password123');
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  
  // Registration states
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regFullName, setRegFullName] = useState<string>('');
  const [regRole, setRegRole] = useState<'patient' | 'doctor' | 'admin'>('doctor');
  const [isRegLoading, setIsRegLoading] = useState<boolean>(false);
  
  // Admin states
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [isAdminUsersLoading, setIsAdminUsersLoading] = useState<boolean>(false);

  // Real-time server log feed state
  const [logs, setLogs] = useState<any[]>([]);
  
  // Dynamic application state
  const [patients, setPatients] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'endpoints' | 'patients' | 'ai' | 'db' | 'pdf'>('endpoints');
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);

  // PDF Vault states & handlers
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [isPdfsLoading, setIsPdfsLoading] = useState<boolean>(false);
  const [isPdfUploading, setIsPdfUploading] = useState<boolean>(false);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [extractedPdf, setExtractedPdf] = useState<any | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState<boolean>(false);
  const [extractionModalOpen, setExtractionModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'pages' | 'chunks' | 'search' | 'llama'>('pages');
  const [vectorSearchQuery, setVectorSearchQuery] = useState<string>('');
  const [vectorSearchResults, setVectorSearchResults] = useState<any | null>(null);
  const [isSearchingVector, setIsSearchingVector] = useState<boolean>(false);
  const [selectedPdfIdForSearch, setSelectedPdfIdForSearch] = useState<number | null>(null);
  
  // Llama 3 states & Chat history structures
  interface LlamaMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    contextChunks?: any[];
  }

  interface LlamaChat {
    id: string;
    pdfId: number;
    title: string;
    createdAt: string;
    messages: LlamaMessage[];
  }

  const [llamaChats, setLlamaChats] = useState<LlamaChat[]>([]);
  const [activeLlamaChatId, setActiveLlamaChatId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renamingChatTitle, setRenamingChatTitle] = useState<string>('');
  const [llamaQuery, setLlamaQuery] = useState<string>('');
  const [llamaAnswer, setLlamaAnswer] = useState<string>('');
  const [llamaContextChunks, setLlamaContextChunks] = useState<any[]>([]);
  const [isLlamaQuerying, setIsLlamaQuerying] = useState<boolean>(false);
  const [llamaApiKey, setLlamaApiKey] = useState<string>('');
  const [llamaProvider, setLlamaProvider] = useState<'groq' | 'huggingface' | 'openrouter' | 'gemini_fallback'>('gemini_fallback');

  const fetchPdfs = async (token = authToken) => {
    if (!token) {
      setPdfs([]);
      return;
    }
    setIsPdfsLoading(true);
    try {
      const res = await fetch('/api/v1/pdfs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPdfs(data);
      }
    } catch (err) {
      console.error('Error fetching PDFs', err);
    } finally {
      setIsPdfsLoading(false);
    }
  };

  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPdfFile) {
      setPdfError('Please select a PDF file first.');
      return;
    }
    if (selectedPdfFile.type !== 'application/pdf' && !selectedPdfFile.name.toLowerCase().endsWith('.pdf')) {
      setPdfError('Only PDF files are allowed.');
      return;
    }
    if (selectedPdfFile.size > 20 * 1024 * 1024) {
      setPdfError('File size exceeds the 20MB limit.');
      return;
    }

    setIsPdfUploading(true);
    setPdfError(null);
    const formData = new FormData();
    formData.append('file', selectedPdfFile);

    try {
      const res = await fetch('/api/v1/pdfs/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showToast('PDF Document secure upload successful!');
        setSelectedPdfFile(null);
        fetchPdfs();
        fetchServerLogs();
      } else {
        setPdfError(data.detail || 'Failed to upload document.');
      }
    } catch (err) {
      setPdfError('Network connection failed.');
    } finally {
      setIsPdfUploading(false);
    }
  };

  const handleDownloadPdf = async (id: number, fileName: string) => {
    try {
      const res = await fetch(`/api/v1/pdfs/${id}/download`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast('Download initiated successfully.');
        fetchServerLogs();
      } else {
        const data = await res.json();
        showToast(data.detail || 'Download failed.');
      }
    } catch (err) {
      showToast('Error downloading file.');
    }
  };

  const handleDeletePdf = async (id: number) => {
    if (!window.confirm('Are you sure you want to permanently delete this PDF and its PostgreSQL metadata?')) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/pdfs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        showToast('Document permanently removed.');
        fetchPdfs();
        fetchServerLogs();
      } else {
        const data = await res.json();
        showToast(data.detail || 'Failed to delete PDF.');
      }
    } catch (err) {
      showToast('Error deleting document.');
    }
  };

  const handleExtractPdfText = async (id: number, fileName: string) => {
    setIsExtractingPdf(true);
    setExtractionModalOpen(true);
    setExtractedPdf(null);
    setModalTab('pages');
    setSelectedPdfIdForSearch(id);
    setVectorSearchQuery('');
    setVectorSearchResults(null);
    setLlamaQuery('');
    setLlamaAnswer('');
    setLlamaContextChunks([]);
    try {
      const res = await fetch(`/api/v1/pdfs/${id}/extract`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setExtractedPdf(data);
        showToast(`Text extraction & FAISS indexing completed for ${fileName}`);
        fetchServerLogs();
      } else {
        showToast(data.detail || 'Failed to extract text.');
        setExtractionModalOpen(false);
      }
    } catch (err) {
      showToast('Error communicating with the text extraction service.');
      setExtractionModalOpen(false);
    } finally {
      setIsExtractingPdf(false);
    }
  };

  const handleVectorSimilaritySearch = async () => {
    if (!selectedPdfIdForSearch) return;
    if (!vectorSearchQuery.trim()) {
      showToast('Please enter a search query first.');
      return;
    }
    setIsSearchingVector(true);
    setVectorSearchResults(null);
    try {
      const res = await fetch(`/api/v1/pdfs/${selectedPdfIdForSearch}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ query: vectorSearchQuery, topK: 5 })
      });
      const data = await res.json();
      if (res.ok) {
        setVectorSearchResults(data);
        showToast('FAISS similarity search completed.');
        fetchServerLogs();
      } else {
        showToast(data.detail || 'Similarity search failed.');
      }
    } catch (err) {
      showToast('Error communicating with FAISS similarity search service.');
    } finally {
      setIsSearchingVector(false);
    }
  };

  // Load and sync Llama chat sessions from LocalStorage for the current PDF
  useEffect(() => {
    if (selectedPdfIdForSearch) {
      const saved = localStorage.getItem(`llama_chats_pdf_${selectedPdfIdForSearch}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setLlamaChats(parsed);
          if (parsed.length > 0) {
            setActiveLlamaChatId(parsed[0].id);
          } else {
            setActiveLlamaChatId(null);
          }
        } catch (e) {
          console.error("Failed to parse llama chats", e);
          setLlamaChats([]);
          setActiveLlamaChatId(null);
        }
      } else {
        // Create an initial welcome conversation thread
        const initialChatId = `chat_${Date.now()}`;
        const newChat: LlamaChat = {
          id: initialChatId,
          pdfId: selectedPdfIdForSearch,
          title: 'Document Workspace',
          createdAt: new Date().toISOString(),
          messages: [
            {
              id: 'welcome',
              role: 'assistant',
              content: "Hello! I am your Meta Llama 3 clinical research assistant. Ask me anything about this document! I will answer your questions using strictly and only the retrieved document context chunks, providing page and block citations.",
              timestamp: new Date().toISOString()
            }
          ]
        };
        setLlamaChats([newChat]);
        setActiveLlamaChatId(initialChatId);
        localStorage.setItem(`llama_chats_pdf_${selectedPdfIdForSearch}`, JSON.stringify([newChat]));
      }
    } else {
      setLlamaChats([]);
      setActiveLlamaChatId(null);
    }
  }, [selectedPdfIdForSearch]);

  const createNewLlamaChat = () => {
    if (!selectedPdfIdForSearch) return;
    const newChatId = `chat_${Date.now()}`;
    const newChat: LlamaChat = {
      id: newChatId,
      pdfId: selectedPdfIdForSearch,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: `welcome_${Date.now()}`,
          role: 'assistant',
          content: "Hello! I am your Meta Llama 3 clinical research assistant. Ask me anything about this document! I will answer your questions using strictly and only the retrieved document context chunks, providing page and block citations.",
          timestamp: new Date().toISOString()
        }
      ]
    };
    const updated = [newChat, ...llamaChats];
    setLlamaChats(updated);
    setActiveLlamaChatId(newChatId);
    localStorage.setItem(`llama_chats_pdf_${selectedPdfIdForSearch}`, JSON.stringify(updated));
    showToast('New chat thread created!');
  };

  const deleteLlamaChat = (chatId: string) => {
    if (!selectedPdfIdForSearch) return;
    const filtered = llamaChats.filter(c => c.id !== chatId);
    setLlamaChats(filtered);
    localStorage.setItem(`llama_chats_pdf_${selectedPdfIdForSearch}`, JSON.stringify(filtered));
    if (activeLlamaChatId === chatId) {
      if (filtered.length > 0) {
        setActiveLlamaChatId(filtered[0].id);
      } else {
        setActiveLlamaChatId(null);
      }
    }
    showToast('Conversation deleted.');
  };

  const sendLlamaMessage = async (text: string) => {
    if (!selectedPdfIdForSearch) {
      showToast('No document selected.');
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      showToast('Please enter a query/question for Llama 3.');
      return;
    }

    // If no active chat exists, create one
    let currentChatId = activeLlamaChatId;
    let currentChats = [...llamaChats];
    
    if (!currentChatId || currentChats.length === 0) {
      const newChatId = `chat_${Date.now()}`;
      const newChat: LlamaChat = {
        id: newChatId,
        pdfId: selectedPdfIdForSearch,
        title: trimmed.length > 25 ? trimmed.substring(0, 25) + '...' : trimmed,
        createdAt: new Date().toISOString(),
        messages: []
      };
      currentChats = [newChat, ...currentChats];
      currentChatId = newChatId;
      setActiveLlamaChatId(newChatId);
    }

    const chatIndex = currentChats.findIndex(c => c.id === currentChatId);
    if (chatIndex === -1) return;

    const activeChat = currentChats[chatIndex];
    
    // Create user message
    const userMsg: LlamaMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString()
    };

    // Update state instantly with user message
    const updatedMessages = [...activeChat.messages, userMsg];
    const updatedChat = {
      ...activeChat,
      messages: updatedMessages
    };
    
    // Auto-update title if it's default
    if (activeChat.title === 'New Conversation' || activeChat.title === 'Document Workspace' || activeChat.messages.length === 0) {
      updatedChat.title = trimmed.length > 25 ? trimmed.substring(0, 25) + '...' : trimmed;
    }

    currentChats[chatIndex] = updatedChat;
    setLlamaChats(currentChats);
    localStorage.setItem(`llama_chats_pdf_${selectedPdfIdForSearch}`, JSON.stringify(currentChats));
    
    // Clear input
    setLlamaQuery('');
    
    // Set loader
    setIsLlamaQuerying(true);

    try {
      // Send chat history (sending role & content)
      const historyPayload = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const res = await fetch(`/api/v1/pdfs/${selectedPdfIdForSearch}/llama-qa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          provider: llamaProvider,
          apiKey: llamaApiKey,
          history: historyPayload
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Create assistant message with retrieved sources
        const assistantMsg: LlamaMessage = {
          id: `msg_${Date.now()}_assist`,
          role: 'assistant',
          content: data.answer,
          timestamp: new Date().toISOString(),
          contextChunks: data.contextChunks || []
        };

        const finalMessages = [...updatedMessages, assistantMsg];
        const finalChat = {
          ...updatedChat,
          messages: finalMessages
        };

        const finalLlamaChats = [...currentChats];
        finalLlamaChats[chatIndex] = finalChat;
        setLlamaChats(finalLlamaChats);
        localStorage.setItem(`llama_chats_pdf_${selectedPdfIdForSearch}`, JSON.stringify(finalLlamaChats));
        showToast('Llama 3 response received!');
        fetchServerLogs();
      } else {
        showToast(data.detail || 'Llama 3 generation failed.');
        const errorMsg: LlamaMessage = {
          id: `msg_${Date.now()}_err`,
          role: 'assistant',
          content: `❌ Generation Error: ${data.detail || 'Verify your API key or endpoint configurations.'}`,
          timestamp: new Date().toISOString()
        };
        const finalChat = {
          ...updatedChat,
          messages: [...updatedMessages, errorMsg]
        };
        const finalLlamaChats = [...currentChats];
        finalLlamaChats[chatIndex] = finalChat;
        setLlamaChats(finalLlamaChats);
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error communicating with Llama 3 service.');
      const errorMsg: LlamaMessage = {
        id: `msg_${Date.now()}_err`,
        role: 'assistant',
        content: `❌ Network Error: Could not connect to the API server.`,
        timestamp: new Date().toISOString()
      };
      const finalChat = {
        ...updatedChat,
        messages: [...updatedMessages, errorMsg]
      };
      const finalLlamaChats = [...currentChats];
      finalLlamaChats[chatIndex] = finalChat;
      setLlamaChats(finalLlamaChats);
    } finally {
      setIsLlamaQuerying(false);
    }
  };

  // Retain handleLlamaRagQuery for backwards-compatibility or simple legacy bindings
  const handleLlamaRagQuery = () => {
    sendLlamaMessage(llamaQuery);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Create Patient Form
  const [newPatientName, setNewPatientName] = useState<string>('');
  const [newPatientDOB, setNewPatientDOB] = useState<string>('1988-06-15');
  const [newPatientGender, setNewPatientGender] = useState<string>('Male');
  const [newPatientPhone, setNewPatientPhone] = useState<string>('+1 (555) 019-4821');
  const [newPatientEmail, setNewPatientEmail] = useState<string>('');
  const [newPatientHistory, setNewPatientHistory] = useState<string>('');
  const [isPatientCreating, setIsPatientCreating] = useState<boolean>(false);

  // Gemini Clinical Analysis Workspace
  const [symptomInput, setSymptomInput] = useState<string>('Patient reports sudden chest tightness accompanied by radiating pain down the left arm, sweating, and nausea.');
  const [selectedPatientHistory, setSelectedPatientHistory] = useState<string>('Diagnosed with hypertension and high cholesterol 5 years ago.');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiReport, setAiReport] = useState<any | null>(null);

  // Alembic migrations
  const [migrationHead, setMigrationHead] = useState<string>('a1c4b2_add_history_table');
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [migrationLogs, setMigrationLogs] = useState<string[]>([
    'INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.',
    'INFO  [alembic.runtime.migration] Will assume transactional DDL.',
    'INFO  [alembic.runtime.migration] Running upgrade  -> 4c23d0, initial database schema',
    'INFO  [alembic.runtime.migration] Running upgrade 4c23d0 -> f92e81, update jwt claims',
    'INFO  [alembic.runtime.migration] Running upgrade f92e81 -> a1c4b2, add patient history table',
  ]);

  // Toast message
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch real server logs
  const fetchServerLogs = async () => {
    try {
      const res = await fetch('/api/v1/simulation/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.reverse());
      }
    } catch (err) {
      console.error('Error fetching logs', err);
    }
  };

  // Fetch current patients (Protected - needs JWT)
  const fetchPatients = async (token = authToken) => {
    if (!token) {
      setPatients([]);
      return;
    }
    try {
      const res = await fetch('/api/v1/patients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPatients(data);
      } else {
        setPatients([]);
      }
    } catch (err) {
      console.error('Error fetching patients', err);
    }
  };

  // Fetch all users (Admin only)
  const fetchAdminUsers = async (token = authToken) => {
    if (!token) return;
    setIsAdminUsersLoading(true);
    try {
      const res = await fetch('/api/v1/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(data);
      }
    } catch (err) {
      console.error('Error fetching admin users', err);
    } finally {
      setIsAdminUsersLoading(false);
    }
  };

  useEffect(() => {
    fetchServerLogs();
    if (authToken) {
      fetchPatients();
      fetchPdfs();
      if (currentUser?.role === 'admin') {
        fetchAdminUsers();
      }
    }
    
    // Poll logs every 2.5 seconds to keep the terminal alive
    const interval = setInterval(() => {
      fetchServerLogs();
    }, 2500);
    return () => clearInterval(interval);
  }, [authToken, currentUser]);

  // Securely login user (JWT token acquisition & decoding)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    try {
      const res = await fetch('/api/v1/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        setAuthToken(data.access_token);
        setCurrentUser(data.user);
        showToast(`Signed in successfully as ${data.user.fullName}!`);
        
        fetchPatients(data.access_token);
        fetchPdfs(data.access_token);
        if (data.user.role === 'admin') {
          fetchAdminUsers(data.access_token);
        }
        fetchServerLogs();
      } else {
        showToast(data.detail || 'Login failed');
      }
    } catch (err) {
      showToast('Connection to server failed.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Securely register user
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regPassword || !regFullName) {
      showToast('Please fill in all registration fields.');
      return;
    }
    setIsRegLoading(true);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          fullName: regFullName,
          role: regRole
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Registered successfully as ${data.fullName}! You can now log in.`);
        setUsername(regEmail);
        setPassword(regPassword);
        setRegEmail('');
        setRegPassword('');
        setRegFullName('');
        fetchServerLogs();
      } else {
        showToast(data.detail || 'Registration failed');
      }
    } catch (err) {
      showToast('Connection to server failed.');
    } finally {
      setIsRegLoading(false);
    }
  };

  // Logout current user
  const handleLogout = () => {
    setAuthToken('');
    setCurrentUser(null);
    setPatients([]);
    setAdminUsers([]);
    setPdfs([]);
    showToast('Logged out successfully.');
  };

  // Create Patient record
  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) {
      showToast('Please enter patient full name.');
      return;
    }
    setIsPatientCreating(true);
    try {
      const res = await fetch('/api/v1/patients', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          fullName: newPatientName,
          dateOfBirth: newPatientDOB,
          gender: newPatientGender,
          phone: newPatientPhone,
          email: newPatientEmail || `${newPatientName.toLowerCase().replace(/\s+/g, '')}@email.com`,
          medicalHistory: newPatientHistory
        })
      });
      if (res.ok) {
        showToast(`Patient record saved successfully!`);
        setNewPatientName('');
        setNewPatientHistory('');
        fetchPatients();
        fetchServerLogs();
      } else {
        const data = await res.json();
        showToast(data.detail || 'Failed to create patient');
      }
    } catch (err) {
      showToast('Error registering patient');
    } finally {
      setIsPatientCreating(false);
    }
  };

  // Delete Patient Record
  const handleDeletePatient = async (id: number) => {
    try {
      const res = await fetch(`/api/v1/patients/${id}`, { 
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        showToast('Patient record deleted');
        fetchPatients();
        fetchServerLogs();
      } else {
        const data = await res.json();
        showToast(data.detail || 'Failed to remove record');
      }
    } catch (err) {
      showToast('Error connecting to endpoint');
    }
  };

  // Trigger Gemini Clinical Diagnosis suggestion
  const handleAIAssessment = async () => {
    setIsAnalyzing(true);
    setAiReport(null);
    try {
      const res = await fetch('/api/v1/ai/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          symptoms: symptomInput,
          patient_history: selectedPatientHistory
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAiReport(data);
        showToast('Clinical report generated via Gemini API');
        fetchServerLogs();
      } else {
        showToast(data.detail || 'Failed to run AI assessment');
      }
    } catch (err) {
      showToast('Error executing server model generation');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Run Alembic schema migrations
  const runAlembicMigration = () => {
    setIsMigrating(true);
    showToast('Running Alembic upgrade head against PostgreSQL...');
    
    setTimeout(() => {
      const randomHead = `a2e${Math.floor(Math.random() * 900 + 100)}a1_add_critical_alerts`;
      setMigrationHead(randomHead);
      setMigrationLogs(prev => [
        ...prev,
        `INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.`,
        `INFO  [alembic.runtime.migration] Will assume transactional DDL.`,
        `INFO  [alembic.runtime.migration] Running upgrade ${migrationHead} -> ${randomHead}, update model relationships`,
      ]);
      setIsMigrating(false);
      showToast('Database migrated to HEAD successfully!');
      fetchServerLogs();
    }, 1500);
  };

  return (
    <div id="hospital-app-root" className="w-full min-h-screen bg-[#0A0C10] text-[#E0E2E6] font-sans flex flex-col md:flex-row overflow-hidden select-none">
      
      {/* Toast Notification */}
      {toast && (
        <div id="app-toast" className="fixed top-5 right-5 bg-[#238636] text-white border border-[#2EA043] px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-bounce">
          <CheckCircle2 size={16} />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* Sidebar: Folder Structure Explorer */}
      <aside id="app-sidebar" className="w-full md:w-80 border-r border-[#1F2937] bg-[#0D1117] flex flex-col shrink-0">
        <div className="p-6 border-b border-[#1F2937]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#58A6FF]/10 text-[#58A6FF] rounded-lg border border-[#58A6FF]/20">
              <Cpu size={20} />
            </span>
            <div>
              <h1 className="text-[#C9D1D9] font-serif text-lg italic tracking-tight">CurisAI</h1>
              <span className="text-[9px] font-sans not-italic opacity-60 block uppercase tracking-widest">
                FastAPI Backend Core
              </span>
            </div>
          </div>
        </div>

        {/* File Browser list */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-3 px-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-[#8B949E]">Code Repository</span>
            <span className="text-[10px] text-emerald-400 px-1.5 py-0.5 bg-emerald-950/30 border border-emerald-900/50 rounded">
              Ready
            </span>
          </div>

          <nav className="space-y-1 font-mono text-xs">
            {/* app/ directory */}
            <div className="flex items-center gap-1.5 py-1 px-2 text-[#58A6FF] font-medium">
              <Folder size={14} className="shrink-0" />
              <span>app/</span>
            </div>

            {/* Sub-directories */}
            <div className="pl-4 space-y-1">
              <div className="flex items-center gap-1.5 py-1 px-2 text-[#8B949E]">
                <Folder size={14} className="shrink-0" />
                <span>core/</span>
              </div>
              <div className="pl-4">
                {BACKEND_FILES.filter(f => f.path.startsWith('app/core')).map(f => (
                  <button
                    key={f.path}
                    onClick={() => setSelectedFile(f)}
                    className={`w-full flex items-center gap-1.5 py-1 px-2 rounded text-left transition-colors ${
                      selectedFile.path === f.path ? 'bg-[#1F2937] text-white font-medium border-l-2 border-[#58A6FF]' : 'text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#161B22]'
                    }`}
                  >
                    <File size={12} className="shrink-0" />
                    <span className="truncate">{f.name}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 py-1 px-2 text-[#8B949E]">
                <Folder size={14} className="shrink-0" />
                <span>models/</span>
              </div>
              <div className="pl-4">
                {BACKEND_FILES.filter(f => f.path.startsWith('app/models')).map(f => (
                  <button
                    key={f.path}
                    onClick={() => setSelectedFile(f)}
                    className={`w-full flex items-center gap-1.5 py-1 px-2 rounded text-left transition-colors ${
                      selectedFile.path === f.path ? 'bg-[#1F2937] text-white font-medium border-l-2 border-[#58A6FF]' : 'text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#161B22]'
                    }`}
                  >
                    <File size={12} className="shrink-0" />
                    <span>{f.name}</span>
                  </button>
                ))}
              </div>

              {/* app root files */}
              {BACKEND_FILES.filter(f => f.path.startsWith('app/') && !f.path.includes('core/') && !f.path.includes('models/')).map(f => (
                <button
                  key={f.path}
                  onClick={() => setSelectedFile(f)}
                  className={`w-full flex items-center gap-1.5 py-1 px-2 rounded text-left transition-colors ${
                    selectedFile.path === f.path ? 'bg-[#1F2937] text-white font-medium border-l-2 border-[#58A6FF]' : 'text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#161B22]'
                  }`}
                >
                  <File size={12} className="shrink-0" />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>

            {/* Root configs */}
            <div className="pt-3 border-t border-[#1F2937]/60 mt-3 space-y-1">
              <span className="text-[10px] text-[#8B949E] uppercase tracking-wider block px-2 mb-1">Infrastructure</span>
              {BACKEND_FILES.filter(f => !f.path.startsWith('app/')).map(f => (
                <button
                  key={f.path}
                  onClick={() => setSelectedFile(f)}
                  className={`w-full flex items-center gap-1.5 py-1 px-2 rounded text-left transition-colors ${
                    selectedFile.path === f.path ? 'bg-[#1F2937] text-white font-medium border-l-2 border-[#58A6FF]' : 'text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#161B22]'
                  }`}
                >
                  <File size={12} className="shrink-0" />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* Environment summary at base */}
        <div className="p-4 bg-[#161B22] border-t border-[#1F2937]">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
            <span className="text-xs uppercase tracking-tight text-[#C9D1D9] font-medium">PostgreSQL Connected</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#8B949E]">
            <span>DB POOL: ACTIVE</span>
            <span>Uptime: 100%</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main id="app-main-workspace" className="flex-1 flex flex-col min-w-0 bg-[#0A0C10]">
        
        {/* Dynamic App Header */}
        <header className="h-20 border-b border-[#1F2937] bg-[#0D1117] px-6 flex items-center justify-between shrink-0">
          <div className="flex gap-6 items-center">
            <div className="flex flex-col">
              <span className="text-[9px] text-[#8B949E] uppercase tracking-widest font-semibold">Active Architecture</span>
              <span className="text-sm font-medium text-white flex items-center gap-1.5">
                FastAPI <span className="text-xs text-[#8B949E]">+</span> SQLAlchemy 2.0
              </span>
            </div>
            <div className="hidden sm:flex flex-col border-l border-[#1F2937] pl-6">
              <span className="text-[9px] text-[#8B949E] uppercase tracking-widest font-semibold">Authentication Guard</span>
              <span className="text-sm font-medium text-emerald-400 flex items-center gap-1">
                <Shield size={14} />
                JWT Auth Enabled
              </span>
            </div>
            <div className="hidden md:flex flex-col border-l border-[#1F2937] pl-6">
              <span className="text-[9px] text-[#8B949E] uppercase tracking-widest font-semibold">Diagnostic Core</span>
              <span className="text-sm font-medium text-purple-400 flex items-center gap-1">
                <Sparkles size={14} />
                Gemini AI Engine
              </span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 bg-[#21262D] border border-[#30363D] hover:bg-[#30363D] text-[#C9D1D9] rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <span>Swagger UI</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </header>

        {/* Top Segment: Interactive Code Viewer */}
        <section id="code-viewer-panel" className="h-72 border-b border-[#1F2937] bg-[#0D1117]/40 flex flex-col overflow-hidden relative">
          <div className="px-6 py-2.5 bg-[#0D1117] border-b border-[#1F2937] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-[#58A6FF]" />
              <span className="text-xs font-mono text-[#C9D1D9]">{selectedFile.path}</span>
            </div>
            <span className="text-[10px] text-[#8B949E] uppercase font-mono">{selectedFile.language}</span>
          </div>
          
          <div className="flex-1 p-6 overflow-y-auto font-mono text-xs leading-relaxed text-[#8B949E] bg-[#090C10]">
            <pre className="whitespace-pre">
              <code>{selectedFile.content}</code>
            </pre>
          </div>
        </section>

        {/* Lower Workspace Segment - Interactive Control Panels */}
        <section className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
          
          {/* Left Block: Client forms & Testing Interface */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Interactive Workspace Navigation Tabs */}
            <div className="flex border-b border-[#1F2937] gap-2">
              <button
                onClick={() => setActiveTab('endpoints')}
                className={`pb-3 px-4 text-xs font-semibold uppercase tracking-wider relative transition-all ${
                  activeTab === 'endpoints' ? 'text-[#58A6FF]' : 'text-[#8B949E] hover:text-[#C9D1D9]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Activity size={14} />
                  <span>API Sandbox</span>
                </div>
                {activeTab === 'endpoints' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#58A6FF]" />}
              </button>

              <button
                onClick={() => setActiveTab('patients')}
                className={`pb-3 px-4 text-xs font-semibold uppercase tracking-wider relative transition-all ${
                  activeTab === 'patients' ? 'text-[#58A6FF]' : 'text-[#8B949E] hover:text-[#C9D1D9]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <UserCheck size={14} />
                  <span>Patient Registry</span>
                </div>
                {activeTab === 'patients' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#58A6FF]" />}
              </button>

              <button
                onClick={() => setActiveTab('ai')}
                className={`pb-3 px-4 text-xs font-semibold uppercase tracking-wider relative transition-all ${
                  activeTab === 'ai' ? 'text-[#58A6FF]' : 'text-[#8B949E] hover:text-[#C9D1D9]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>AI Clinical Engine</span>
                </div>
                {activeTab === 'ai' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#58A6FF]" />}
              </button>

              <button
                onClick={() => setActiveTab('db')}
                className={`pb-3 px-4 text-xs font-semibold uppercase tracking-wider relative transition-all ${
                  activeTab === 'db' ? 'text-[#58A6FF]' : 'text-[#8B949E] hover:text-[#C9D1D9]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Database size={14} />
                  <span>SQL Models</span>
                </div>
                {activeTab === 'db' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#58A6FF]" />}
              </button>

              <button
                onClick={() => setActiveTab('pdf')}
                className={`pb-3 px-4 text-xs font-semibold uppercase tracking-wider relative transition-all ${
                  activeTab === 'pdf' ? 'text-[#58A6FF]' : 'text-[#8B949E] hover:text-[#C9D1D9]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <FileText size={14} />
                  <span>PDF Vault</span>
                </div>
                {activeTab === 'pdf' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#58A6FF]" />}
              </button>
            </div>

            {/* TAB: ENDPOINTS */}
            {activeTab === 'endpoints' && (
              <div className="space-y-6">
                
                {/* Endpoint Endpoint Checklist */}
                <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Active FastAPI Routes</h3>
                      <p className="text-xs text-[#8B949E]">Execute live simulation payloads instantly</p>
                    </div>
                    <span className="text-xs text-[#58A6FF] font-mono">99.98% Latency Health</span>
                  </div>

                  <div className="space-y-2">
                    {ENDPOINTS.map((endpoint) => (
                      <div key={`${endpoint.method}-${endpoint.path}`} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-[#0D1117] border border-[#30363D] rounded-lg gap-2">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded border ${
                            endpoint.method === 'POST' ? 'bg-blue-900/20 text-blue-400 border-blue-800/40' : 'bg-emerald-900/20 text-emerald-400 border-emerald-800/40'
                          }`}>
                            {endpoint.method}
                          </span>
                          <div>
                            <span className="font-mono text-xs text-white block">{endpoint.path}</span>
                            <span className="text-[10px] text-[#8B949E]">{endpoint.desc}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 self-end sm:self-auto">
                          <span className="text-xs text-[#8B949E] font-mono">{endpoint.latency}ms</span>
                          <button
                            onClick={() => {
                              if (endpoint.path.includes('auth')) {
                                setActiveTab('endpoints');
                                showToast('Sign In credentials loaded below.');
                              } else if (endpoint.path.includes('ai')) {
                                setActiveTab('ai');
                              } else {
                                setActiveTab('patients');
                              }
                            }}
                            className="px-2 py-1 bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[10px] rounded text-white flex items-center gap-1"
                          >
                            <Play size={10} />
                            <span>Inspect</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Authentication Panel */}
                <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 space-y-6">
                  
                  {currentUser ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-[#30363D] pb-3">
                        <div className="flex items-center gap-2">
                          <Lock size={16} className="text-[#58A6FF]" />
                          <h3 className="text-sm font-semibold text-white">Active Session Security Context</h3>
                        </div>
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-900 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                          {currentUser.role} Account Active
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#0D1117] p-4 border border-[#30363D] rounded-lg">
                        <div>
                          <span className="text-[9px] uppercase font-semibold text-[#8B949E] block mb-0.5">Clinician / User Name</span>
                          <span className="text-sm font-semibold text-white">{currentUser.fullName}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-semibold text-[#8B949E] block mb-0.5">Authorized Email</span>
                          <span className="text-sm font-mono text-[#58A6FF]">{currentUser.email}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-semibold text-[#8B949E] block mb-0.5">Security Role Badge</span>
                          <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full mt-1 ${
                            currentUser.role === 'admin' ? 'bg-red-900/30 text-red-400 border border-red-800/40' :
                            currentUser.role === 'doctor' ? 'bg-blue-900/30 text-blue-400 border border-blue-800/40' :
                            'bg-purple-900/30 text-purple-400 border border-purple-800/40'
                          }`}>
                            {currentUser.role.toUpperCase()}
                          </span>
                        </div>
                        {currentUser.patientId && (
                          <div>
                            <span className="text-[9px] uppercase font-semibold text-[#8B949E] block mb-0.5">Mapped Patient Profile ID</span>
                            <span className="text-sm font-mono text-amber-400">PAT-{currentUser.patientId}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[#8B949E]">All API requests are now protected and signed with your JWT token.</span>
                        <button
                          onClick={handleLogout}
                          className="px-4 py-1.5 bg-[#21262D] hover:bg-red-950/20 text-xs font-semibold rounded text-white hover:text-red-400 border border-[#30363D] hover:border-red-900 transition-colors"
                        >
                          Log Out Session
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-[#30363D]">
                      
                      {/* Sign In form */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-bold uppercase text-[#58A6FF] tracking-wider mb-1">Sign In</h4>
                          <p className="text-xs text-[#8B949E]">Acquire a secure OAuth2 JWT Token</p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-3">
                          <div>
                            <label className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-1">Email / Username</label>
                            <input
                              type="email"
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              placeholder="doctor@hospital.com"
                              className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#58A6FF]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-1">Password</label>
                            <input
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#58A6FF]"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={isAuthLoading}
                            className="w-full px-4 py-1.5 bg-[#238636] hover:bg-[#2ea043] text-xs font-semibold rounded text-white flex items-center justify-center gap-1.5 transition-colors"
                          >
                            {isAuthLoading ? <RefreshCw size={12} className="animate-spin" /> : <Lock size={12} />}
                            <span>Sign In & Authorize</span>
                          </button>
                        </form>

                        <div className="pt-2">
                          <span className="text-[10px] uppercase font-bold text-[#8B949E] block mb-1.5">Quick Play Sandbox Logins:</span>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => { setUsername('doctor@hospital.com'); setPassword('password123'); }}
                              className="px-2 py-1 bg-[#0D1117] hover:bg-[#30363D] border border-[#30363D] rounded text-[10px] text-white"
                            >
                              Dr. Vance (Doctor)
                            </button>
                            <button
                              onClick={() => { setUsername('admin@hospital.com'); setPassword('admin123'); }}
                              className="px-2 py-1 bg-[#0D1117] hover:bg-[#30363D] border border-[#30363D] rounded text-[10px] text-white"
                            >
                              Admin System
                            </button>
                            <button
                              onClick={() => { setUsername('patient@hospital.com'); setPassword('patient123'); }}
                              className="px-2 py-1 bg-[#0D1117] hover:bg-[#30363D] border border-[#30363D] rounded text-[10px] text-white"
                            >
                              John Doe (Patient)
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Register form */}
                      <div className="space-y-4 md:pl-6 pt-4 md:pt-0">
                        <div>
                          <h4 className="text-xs font-bold uppercase text-purple-400 tracking-wider mb-1">Register Account</h4>
                          <p className="text-xs text-[#8B949E]">Create a new user with hashed bcrypt credentials</p>
                        </div>

                        <form onSubmit={handleRegister} className="space-y-3">
                          <div>
                            <label className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-1">Full Name</label>
                            <input
                              type="text"
                              value={regFullName}
                              onChange={(e) => setRegFullName(e.target.value)}
                              placeholder="e.g. Dr. Jordan Mercer"
                              className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-1">Email Address</label>
                            <input
                              type="email"
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              placeholder="jordan.m@hospital.com"
                              className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-1">Password</label>
                            <input
                              type="password"
                              value={regPassword}
                              onChange={(e) => setRegPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-1">Assign User Role</label>
                            <select
                              value={regRole}
                              onChange={(e: any) => setRegRole(e.target.value)}
                              className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                            >
                              <option value="doctor">Doctor (Clinical Diagnostics)</option>
                              <option value="admin">Admin (Full Overlord & Registry Management)</option>
                              <option value="patient">Patient (View personal file & diagnoses)</option>
                            </select>
                          </div>
                          <button
                            type="submit"
                            disabled={isRegLoading}
                            className="w-full px-4 py-1.5 bg-purple-900/60 hover:bg-purple-800 text-xs font-semibold rounded text-white border border-purple-800/40 flex items-center justify-center gap-1.5 transition-colors"
                          >
                            {isRegLoading ? <RefreshCw size={12} className="animate-spin" /> : <Lock size={12} />}
                            <span>Register & Encrypt with Bcrypt</span>
                          </button>
                        </form>
                      </div>

                    </div>
                  )}

                  {authToken && (
                    <div className="mt-4 p-3 bg-[#0D1117] border border-[#30363D] rounded font-mono text-[10px] text-[#58A6FF] break-all">
                      <span className="text-white uppercase font-bold text-[8px] tracking-wide block mb-1">Generated Session JWT Token</span>
                      {authToken}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB: PATIENT REGISTRY */}
            {activeTab === 'patients' && (
              <div className="space-y-6">
                {!currentUser ? (
                  <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-8 text-center space-y-4">
                    <div className="p-3 bg-amber-950/30 text-amber-400 inline-block rounded-full border border-amber-900/40">
                      <Lock size={28} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Registry Access Restricted</h3>
                      <p className="text-xs text-[#8B949E] mt-1">Please sign in or register an account in the API Sandbox tab first to authenticate.</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('endpoints')}
                      className="px-4 py-2 bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] rounded-lg text-xs font-semibold text-white transition-colors"
                    >
                      Go to API Sandbox & Login
                    </button>
                  </div>
                ) : currentUser.role === 'patient' ? (
                  <div className="space-y-6">
                    {/* Patient's Own Profile */}
                    <div className="bg-[#161B22] border border-purple-500/30 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="p-1.5 bg-purple-950 text-purple-400 rounded-lg border border-purple-900">
                          <User size={18} />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-white">Your Personal Health Record</h3>
                          <p className="text-xs text-[#8B949E]">Managed securely under Patient Profile ID: PAT-{currentUser.patientId || 'N/A'}</p>
                        </div>
                      </div>

                      {patients.length === 0 ? (
                        <div className="p-4 bg-[#0D1117] border border-[#30363D] rounded-lg text-center">
                          <p className="text-xs text-[#8B949E]">No medical profile is registered for your email yet. Ask an administrator or doctor to create one.</p>
                        </div>
                      ) : (
                        patients.map((pat) => (
                          <div key={pat.id} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0D1117] p-4 border border-[#30363D] rounded-lg">
                              <div>
                                <span className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-0.5">Full Name</span>
                                <span className="text-sm font-semibold text-white">{pat.fullName}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-0.5">Date of Birth</span>
                                <span className="text-sm text-white">{pat.dateOfBirth}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-0.5">Gender</span>
                                <span className="text-sm text-white">{pat.gender}</span>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-0.5">Contact Phone</span>
                                <span className="text-sm text-white">{pat.phone}</span>
                              </div>
                              <div className="md:col-span-2">
                                <span className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-0.5">Contact Email</span>
                                <span className="text-sm text-[#58A6FF]">{pat.email}</span>
                              </div>
                            </div>

                            {pat.medicalHistory && (
                              <div className="p-4 bg-[#0D1117] border border-[#30363D] rounded-lg">
                                <span className="text-[10px] text-[#58A6FF] font-semibold uppercase block mb-1">Your Registered Medical History & Allergies:</span>
                                <p className="text-xs text-[#C9D1D9] leading-relaxed">{pat.medicalHistory}</p>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  // Doctor or Admin View
                  <div className="space-y-6">
                    {/* Register New Patient */}
                    <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-1.5">
                        <Plus size={16} className="text-[#58A6FF]" />
                        <span>Register New Patient Profile</span>
                      </h3>

                      <form onSubmit={handleCreatePatient} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-1">Full Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Alice Cooper"
                            value={newPatientName}
                            onChange={(e) => setNewPatientName(e.target.value)}
                            className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#58A6FF]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-1">Date of Birth</label>
                          <input
                            type="date"
                            value={newPatientDOB}
                            onChange={(e) => setNewPatientDOB(e.target.value)}
                            className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#58A6FF]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-1">Gender</label>
                          <select
                            value={newPatientGender}
                            onChange={(e) => setNewPatientGender(e.target.value)}
                            className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#58A6FF]"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-1">Phone Contact</label>
                          <input
                            type="text"
                            value={newPatientPhone}
                            onChange={(e) => setNewPatientPhone(e.target.value)}
                            className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#58A6FF]"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-1">Chronic Medical History / Allergies</label>
                          <textarea
                            placeholder="Specify general conditions or drug reactions..."
                            value={newPatientHistory}
                            onChange={(e) => setNewPatientHistory(e.target.value)}
                            rows={2}
                            className="w-full bg-[#0D1117] border border-[#30363D] rounded p-3 text-xs text-white focus:outline-none focus:border-[#58A6FF] resize-none"
                          />
                        </div>

                        <div className="md:col-span-2 flex justify-end">
                          <button
                            type="submit"
                            disabled={isPatientCreating}
                            className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] rounded text-xs font-semibold text-white flex items-center gap-1.5"
                          >
                            {isPatientCreating ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={14} />}
                            <span>Save Patient Record</span>
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Active Patient Database list */}
                    <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-white mb-4">Database Medical Profiles (All Patients)</h3>
                      <div className="space-y-3">
                        {patients.length === 0 ? (
                          <p className="text-xs text-[#8B949E]">No patient records registered.</p>
                        ) : (
                          patients.map((pat) => (
                            <div key={pat.id} className="p-4 bg-[#0D1117] border border-[#30363D] rounded-lg">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-semibold text-white text-sm">{pat.fullName}</h4>
                                  <p className="text-xs text-[#8B949E] mt-0.5">DOB: {pat.dateOfBirth} | Gender: {pat.gender} | Contact: {pat.phone}</p>
                                </div>
                                <button
                                  onClick={() => handleDeletePatient(pat.id)}
                                  className="p-1.5 bg-[#21262D] hover:bg-red-950/40 border border-[#30363D] hover:border-red-900 text-[#8B949E] hover:text-red-400 rounded transition-colors"
                                  title="Delete Patient Record"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              {pat.medicalHistory && (
                                <div className="mt-3 p-2 bg-[#161B22] rounded border border-[#30363D] text-xs">
                                  <span className="text-[10px] text-[#58A6FF] font-semibold uppercase block">Allergies & History:</span>
                                  <span className="text-[#C9D1D9]">{pat.medicalHistory}</span>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: AI CLINICAL ENGINE */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                {!currentUser ? (
                  <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-8 text-center space-y-4">
                    <div className="p-3 bg-amber-950/30 text-amber-400 inline-block rounded-full border border-amber-900/40">
                      <Lock size={28} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Clinical AI Engine Access Restricted</h3>
                      <p className="text-xs text-[#8B949E] mt-1">Please sign in or register as a Doctor or Admin to run clinical diagnosis recommendations.</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('endpoints')}
                      className="px-4 py-2 bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] rounded-lg text-xs font-semibold text-white transition-colors"
                    >
                      Go to API Sandbox & Login
                    </button>
                  </div>
                ) : currentUser.role === 'patient' ? (
                  <div className="bg-[#161B22] border border-purple-500/30 rounded-xl p-8 text-center space-y-4">
                    <div className="p-3 bg-purple-950/30 text-purple-400 inline-block rounded-full border border-purple-900/40">
                      <ShieldAlert size={28} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Clinician-Only Workspace</h3>
                      <p className="text-xs text-[#8B949E] mt-1">
                        As a registered Patient, you do not have permission to trigger clinical diagnosis suggestions. 
                        Please navigate to the <span className="text-[#58A6FF] font-medium">Patient Registry</span> tab to view your records.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Symptoms Assessment Playground */}
                    <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className="text-purple-400" />
                          <h3 className="text-sm font-semibold text-white">Gemini Clinical Diagnosis Suggestion</h3>
                        </div>
                        <span className="text-[10px] bg-purple-950/50 border border-purple-800 text-purple-400 px-2 py-0.5 rounded-full font-mono">
                          model: gemini-2.5-flash
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-1">Patient Symptoms Description</label>
                          <textarea
                            value={symptomInput}
                            onChange={(e) => setSymptomInput(e.target.value)}
                            rows={3}
                            className="w-full bg-[#0D1117] border border-[#30363D] rounded p-3 text-xs text-white focus:outline-none focus:border-[#58A6FF] resize-none font-sans"
                            placeholder="Detail acute symptoms..."
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-semibold text-[#8B949E] block mb-1">Historical Medical Context</label>
                          <input
                            type="text"
                            value={selectedPatientHistory}
                            onChange={(e) => setSelectedPatientHistory(e.target.value)}
                            className="w-full bg-[#0D1117] border border-[#30363D] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#58A6FF]"
                            placeholder="Chronic diseases, active medications, etc..."
                          />
                        </div>

                        <div className="flex justify-end">
                          <button
                            onClick={handleAIAssessment}
                            disabled={isAnalyzing}
                            className="px-5 py-2.5 bg-gradient-to-r from-purple-800 to-indigo-900 border border-purple-700 hover:brightness-110 text-xs font-semibold text-white rounded-lg flex items-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                          >
                            {isAnalyzing ? (
                              <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Interrogating Model...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={14} />
                                <span>Generate Clinical Report</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Gemini Diagnostic Response Rendering */}
                    {aiReport && (
                      <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-6 space-y-5 animate-fade-in">
                        <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-emerald-400" />
                            <h4 className="font-serif italic text-white text-lg">AI Consultation Summary</h4>
                          </div>
                          <span className="text-[10px] text-[#8B949E] font-mono">Precision: 0.98</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          <div className="p-4 bg-[#161B22] border border-[#30363D] rounded-lg">
                            <span className="text-[9px] uppercase font-semibold text-emerald-400 block mb-1 tracking-wider">Suggested Primary Diagnosis</span>
                            <p className="text-sm font-medium text-white">{aiReport.suggested_diagnosis}</p>
                          </div>

                          <div className="p-4 bg-[#161B22] border border-[#30363D] rounded-lg">
                            <span className="text-[9px] uppercase font-semibold text-[#58A6FF] block mb-1 tracking-wider">Suggested Specialists</span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {aiReport.suggested_specialists?.map((spec: string, idx: number) => (
                                <span key={`${spec}-${idx}`} className="px-2 py-0.5 bg-blue-950/50 border border-blue-900 text-blue-400 text-[10px] font-medium rounded">
                                  {spec}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="md:col-span-2 p-4 bg-[#161B22] border border-[#30363D] rounded-lg">
                            <span className="text-[9px] uppercase font-semibold text-purple-400 block mb-1 tracking-wider">Clinical Context Analysis</span>
                            <p className="text-xs text-[#C9D1D9] leading-relaxed mt-1">{aiReport.ai_summary}</p>
                          </div>

                          <div className="md:col-span-2 p-4 bg-[#161B22] border border-[#30363D] rounded-lg">
                            <span className="text-[9px] uppercase font-semibold text-amber-400 block mb-1 tracking-wider">Recommended Tests & Imaging</span>
                            <ul className="list-disc pl-4 text-xs text-[#C9D1D9] space-y-1 mt-1">
                              {aiReport.recommended_tests?.map((test: string, idx: number) => (
                                <li key={`${test}-${idx}`}>{test}</li>
                              ))}
                            </ul>
                          </div>

                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* TAB: DATABASE SCHEMAS & MODELS */}
            {activeTab === 'db' && (
              <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">PostgreSQL Relational Relational Schema</h3>
                  <p className="text-xs text-[#8B949E]">Engineered using SQLAlchemy declarative structures</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[11px]">
                  
                  <div className="p-4 bg-[#0D1117] border border-[#30363D] rounded-lg">
                    <span className="text-xs text-[#58A6FF] font-bold block mb-2">TABLE: users</span>
                    <div className="space-y-1.5 text-[#8B949E]">
                      <div>id: <span className="text-emerald-400">INTEGER (PK)</span></div>
                      <div>email: <span className="text-white">VARCHAR(255)</span></div>
                      <div>hashed_password: <span className="text-white">VARCHAR(255)</span></div>
                      <div>full_name: <span className="text-white">VARCHAR(255)</span></div>
                      <div>role: <span className="text-amber-400">ENUM(UserRole)</span></div>
                      <div>is_active: <span className="text-white">BOOLEAN</span></div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#0D1117] border border-[#30363D] rounded-lg">
                    <span className="text-xs text-[#58A6FF] font-bold block mb-2">TABLE: patients</span>
                    <div className="space-y-1.5 text-[#8B949E]">
                      <div>id: <span className="text-emerald-400">INTEGER (PK)</span></div>
                      <div>full_name: <span className="text-white">VARCHAR(255)</span></div>
                      <div>date_of_birth: <span className="text-white">VARCHAR(50)</span></div>
                      <div>gender: <span className="text-white">VARCHAR(50)</span></div>
                      <div>phone: <span className="text-white">VARCHAR(50)</span></div>
                      <div>medical_history: <span className="text-white">TEXT</span></div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#0D1117] border border-[#30363D] rounded-lg">
                    <span className="text-xs text-[#58A6FF] font-bold block mb-2">TABLE: consultations</span>
                    <div className="space-y-1.5 text-[#8B949E]">
                      <div>id: <span className="text-emerald-400">INTEGER (PK)</span></div>
                      <div>patient_id: <span className="text-purple-400">INTEGER (FK)</span></div>
                      <div>doctor_id: <span className="text-purple-400">INTEGER (FK)</span></div>
                      <div>symptoms: <span className="text-white">TEXT</span></div>
                      <div>clinical_notes: <span className="text-white">TEXT</span></div>
                      <div>status: <span className="text-white">VARCHAR(50)</span></div>
                    </div>
                  </div>

                </div>

                {currentUser?.role === 'admin' && (
                  <div className="border-t border-[#30363D] pt-6 space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-purple-400 mb-1">Admin Dashboard: Managed System Users</h3>
                      <p className="text-xs text-[#8B949E]">Securely fetched from protected administrative endpoint `GET /api/v1/admin/users`</p>
                    </div>

                    {isAdminUsersLoading ? (
                      <div className="flex items-center justify-center p-4">
                        <RefreshCw size={18} className="animate-spin text-purple-400" />
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-[11px] border border-[#30363D] rounded-lg">
                          <thead>
                            <tr className="bg-[#0D1117] border-b border-[#30363D] text-[#8B949E]">
                              <th className="p-2.5">ID</th>
                              <th className="p-2.5">Name</th>
                              <th className="p-2.5">Email</th>
                              <th className="p-2.5">Role</th>
                              <th className="p-2.5">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminUsers.map((user: any) => (
                              <tr key={user.id} className="border-b border-[#30363D]/50 hover:bg-[#0D1117]/30">
                                <td className="p-2.5 text-white font-bold">{user.id}</td>
                                <td className="p-2.5 text-white">{user.fullName}</td>
                                <td className="p-2.5 text-[#58A6FF]">{user.email}</td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    user.role === 'admin' ? 'bg-red-950 text-red-400 border border-red-900/50' :
                                    user.role === 'doctor' ? 'bg-blue-950 text-blue-400 border border-blue-900/50' :
                                    'bg-purple-950 text-purple-400 border border-purple-900/50'
                                  }`}>
                                    {user.role}
                                  </span>
                                </td>
                                <td className="p-2.5">
                                  <span className="text-emerald-400">● Active</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* TAB: PDF VAULT */}
            {activeTab === 'pdf' && (
              <div className="space-y-6">
                
                {/* PDF Vault Section Header & Security Banner */}
                <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#30363D] pb-4 mb-4 gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <Shield className="text-emerald-400" size={16} />
                        <span>Secure PDF Document Vault</span>
                      </h3>
                      <p className="text-xs text-[#8B949E] mt-0.5">Strict PDF-only validation, max 20MB. Encrypted locally and metadata persisted in PostgreSQL.</p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 px-2.5 py-1 bg-emerald-950/40 border border-emerald-900 rounded-lg flex items-center gap-1">
                      <Lock size={10} />
                      <span>PostgreSQL Secured</span>
                    </span>
                  </div>

                  {!authToken ? (
                    <div className="text-center py-8 bg-[#0D1117] border border-dashed border-[#30363D] rounded-lg">
                      <Lock className="mx-auto mb-3 text-amber-500/80" size={28} />
                      <h4 className="text-sm font-medium text-white">Access Denied</h4>
                      <p className="text-xs text-[#8B949E] mt-1 max-w-sm mx-auto">Please authenticate under the API Sandbox tab first to retrieve your secure session token before uploading files.</p>
                      <button
                        onClick={() => setActiveTab('endpoints')}
                        className="mt-4 px-3 py-1.5 bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-xs font-semibold rounded text-white"
                      >
                        Sign In Now
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      
                      {/* Drag & Drop Upload Container */}
                      <form 
                        onSubmit={handlePdfUpload}
                        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragActive(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            const file = e.dataTransfer.files[0];
                            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                              setSelectedPdfFile(file);
                              setPdfError(null);
                            } else {
                              setPdfError('Only PDF files are supported.');
                            }
                          }
                        }}
                        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                          dragActive 
                            ? 'border-[#58A6FF] bg-[#58A6FF]/5' 
                            : selectedPdfFile 
                              ? 'border-emerald-500/50 bg-emerald-950/5' 
                              : 'border-[#30363D] bg-[#0D1117] hover:border-[#8B949E]'
                        }`}
                      >
                        <input
                          id="pdf-file-input"
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setSelectedPdfFile(e.target.files[0]);
                              setPdfError(null);
                            }
                          }}
                          className="hidden"
                        />

                        {!selectedPdfFile ? (
                          <div className="space-y-2">
                            <div className="p-3 bg-[#1F2937]/50 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-[#8B949E]">
                              <FileText size={22} />
                            </div>
                            <div className="text-xs text-[#C9D1D9]">
                              <label htmlFor="pdf-file-input" className="text-[#58A6FF] hover:underline cursor-pointer font-semibold">
                                Click to select a file
                              </label>{' '}
                              or drag and drop it here
                            </div>
                            <p className="text-[10px] text-[#8B949E]">Strictly PDF only (maximum size 20MB)</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-center gap-2.5 max-w-md mx-auto bg-[#161B22] p-3 rounded-lg border border-emerald-900/30">
                              <FileText className="text-emerald-400 shrink-0" size={20} />
                              <div className="text-left min-w-0 flex-1">
                                <span className="text-xs font-semibold text-white truncate block">{selectedPdfFile.name}</span>
                                <span className="text-[10px] text-[#8B949E] block">{formatBytes(selectedPdfFile.size)}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedPdfFile(null)}
                                className="text-xs text-red-400 hover:text-red-300 p-1 font-semibold"
                              >
                                Remove
                              </button>
                            </div>

                            <button
                              type="submit"
                              disabled={isPdfUploading}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow transition-colors flex items-center justify-center gap-1.5 mx-auto min-w-[140px]"
                            >
                              {isPdfUploading ? (
                                <>
                                  <RefreshCw size={12} className="animate-spin" />
                                  <span>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <Plus size={12} />
                                  <span>Upload Document</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </form>

                      {pdfError && (
                        <div className="p-3 bg-red-950/30 border border-red-900/50 text-red-400 text-xs rounded-lg flex items-start gap-2">
                          <ShieldAlert className="shrink-0 mt-0.5" size={14} />
                          <span>{pdfError}</span>
                        </div>
                      )}

                      {/* PDF Documents Registry */}
                      <div className="border-t border-[#30363D] pt-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs uppercase font-bold tracking-wider text-[#8B949E]">
                            Document Registry ({pdfs.length})
                          </span>
                          <button
                            onClick={() => fetchPdfs()}
                            disabled={isPdfsLoading}
                            className="p-1.5 hover:bg-[#30363D] border border-transparent hover:border-[#30363D] rounded text-[#8B949E] hover:text-white transition-all"
                            title="Refresh registry"
                          >
                            <RefreshCw size={12} className={isPdfsLoading ? 'animate-spin' : ''} />
                          </button>
                        </div>

                        {isPdfsLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <RefreshCw size={22} className="animate-spin text-[#58A6FF]" />
                          </div>
                        ) : pdfs.length === 0 ? (
                          <div className="text-center py-12 bg-[#0D1117] border border-[#30363D] rounded-lg">
                            <FileText className="mx-auto text-[#30363D] mb-2" size={32} />
                            <h4 className="text-xs font-medium text-[#8B949E]">No Documents Registered</h4>
                            <p className="text-[10px] text-[#8B949E]/60 mt-1 max-w-xs mx-auto">
                              No PDF files found. Upload patient reports, clinical scans, or diagnostic files above to populate the repository.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border border-[#30363D] rounded-lg overflow-hidden font-mono text-xs">
                              <thead>
                                <tr className="bg-[#0D1117] border-b border-[#30363D] text-[#8B949E]">
                                  <th className="p-3">File Name</th>
                                  <th className="p-3">Size</th>
                                  <th className="p-3 hidden md:table-cell">Uploaded By</th>
                                  <th className="p-3 hidden sm:table-cell">Date</th>
                                  <th className="p-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pdfs.map((pdf) => (
                                  <tr key={pdf.id} className="border-b border-[#30363D]/40 hover:bg-[#161B22]/40 transition-colors">
                                    <td className="p-3 text-white max-w-[200px] truncate" title={pdf.fileName}>
                                      <div className="flex items-center gap-2">
                                        <FileText className="text-red-400 shrink-0" size={14} />
                                        <span>{pdf.fileName}</span>
                                      </div>
                                    </td>
                                    <td className="p-3 text-[#C9D1D9]">{formatBytes(pdf.fileSize)}</td>
                                    <td className="p-3 hidden md:table-cell text-[#8B949E]">
                                      <div className="flex flex-col">
                                        <span className="text-white font-sans">{pdf.uploaderName || 'Self'}</span>
                                        <span className="text-[9px] opacity-60">{pdf.uploaderEmail || currentUser.email}</span>
                                      </div>
                                    </td>
                                    <td className="p-3 hidden sm:table-cell text-[#8B949E]">
                                      {new Date(pdf.uploadedAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                                      <button
                                        onClick={() => handleExtractPdfText(pdf.id, pdf.fileName)}
                                        className="px-2 py-1 bg-[#238636] hover:bg-[#2ea043] border border-[#2ea043] text-[10px] text-white rounded transition-colors inline-flex items-center gap-1 font-semibold"
                                      >
                                        <Eye size={10} />
                                        <span>Extract Text</span>
                                      </button>
                                      <button
                                        onClick={() => handleDownloadPdf(pdf.id, pdf.fileName)}
                                        className="px-2 py-1 bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[10px] text-white rounded transition-colors inline-flex items-center gap-1"
                                      >
                                        Download
                                      </button>
                                      <button
                                        onClick={() => handleDeletePdf(pdf.id)}
                                        className="p-1 hover:bg-red-950/40 hover:text-red-400 border border-transparent hover:border-red-900/30 rounded text-[#8B949E] transition-colors inline-flex items-center justify-center align-middle"
                                        title="Delete document"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                </div>

              </div>
            )}

          </div>

          {/* Right Block: Alembic migrations & Real Server Log stream */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Alembic Migrations Manager Panel */}
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#8B949E]">Alembic Migrations</span>
                <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 border border-emerald-900 bg-emerald-950/30 rounded-full">
                  HEAD: {migrationHead.slice(0, 8)}
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-[#0D1117] border border-[#30363D] rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs text-white">
                    <span className="font-semibold">Current State</span>
                    <span className="text-[#8B949E] font-mono">Revision: HEAD</span>
                  </div>
                  <div className="w-full bg-[#1F2937] rounded-full h-1">
                    <div className="bg-[#238636] h-1 rounded-full w-full" />
                  </div>
                </div>

                <div className="bg-[#090C10] p-3 rounded border border-[#1F2937] font-mono text-[9px] text-[#8B949E] leading-relaxed max-h-24 overflow-y-auto">
                  {migrationLogs.map((log, i) => (
                    <div key={i} className="truncate">{log}</div>
                  ))}
                </div>

                <button
                  onClick={runAlembicMigration}
                  disabled={isMigrating}
                  className="w-full py-1.5 bg-[#21262D] hover:bg-[#30363D] text-white border border-[#30363D] text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1.5"
                >
                  {isMigrating ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                  <span>Run alembic upgrade head</span>
                </button>
              </div>
            </div>

            {/* Live Server Log Console */}
            <div className="bg-[#0D1117] border border-[#30363D] rounded-xl p-5 flex-1 flex flex-col min-h-[300px] overflow-hidden">
              <div className="flex items-center justify-between mb-3 border-b border-[#1F2937]/80 pb-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#8B949E] flex items-center gap-1.5">
                  <Terminal size={12} />
                  <span>Interactive Terminal</span>
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="font-mono text-[10px] leading-relaxed space-y-2 overflow-y-auto flex-1 text-[#8B949E] pr-2">
                {logs.map((log, i) => (
                  <div key={i} className="border-b border-[#1F2937]/30 pb-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] opacity-50 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      {log.method && (
                        <span className={`px-1 py-0.2 rounded font-bold text-[8px] ${
                          log.method === 'POST' ? 'bg-blue-900/40 text-blue-400' : 'bg-emerald-900/40 text-emerald-400'
                        }`}>
                          {log.method} {log.status}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5">
                      <span className={`font-semibold mr-1.5 ${
                        log.type === 'ERROR' ? 'text-red-400' : log.type === 'WARN' ? 'text-amber-400' : log.type === 'SUCCESS' ? 'text-emerald-400' : 'text-blue-400'
                      }`}>
                        [{log.type}]
                      </span>
                      <span className="text-[#C9D1D9]">{log.message}</span>
                      {log.path && <span className="text-[#8B949E] block text-[9px] mt-0.5">{log.path}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </section>

        {/* Footer StatusBar */}
        <footer className="h-10 bg-[#0D1117] border-t border-[#1F2937] px-6 flex items-center justify-between text-[9px] text-[#8B949E] shrink-0 font-mono">
          <div className="flex gap-6 uppercase tracking-wider">
            <span>Server region: us-east-1</span>
            <span>REST Protocol: HTTP/2</span>
            <span>Sandbox system payload: healthy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Ready for deployment</span>
          </div>
        </footer>

        {/* TEXT EXTRACTION OVERLAY / MODAL */}
        {extractionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-[#161B22] border border-[#30363D] rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl animate-fade-in">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#30363D] bg-[#0D1117] rounded-t-xl">
                <div className="flex items-center gap-2">
                  <BookOpen className="text-[#58A6FF]" size={18} />
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      PyMuPDF Structured Text Extractor & Chunking Engine
                    </h3>
                    <p className="text-[10px] text-[#8B949E] mt-0.5">
                      {extractedPdf ? `Document: ${extractedPdf.filename} (${extractedPdf.totalPages} Pages)` : 'Processing document text extraction...'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setExtractionModalOpen(false);
                    setExtractedPdf(null);
                  }}
                  className="text-xs text-[#8B949E] hover:text-white px-2 py-1 rounded hover:bg-[#21262D] transition-colors"
                >
                  Close
                </button>
              </div>

              {/* RAG & Text Tab Switcher */}
              {extractedPdf && (
                <div className="flex border-b border-[#30363D] bg-[#161B22] px-4 gap-2">
                  <button
                    onClick={() => setModalTab('pages')}
                    className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider relative transition-all ${
                      modalTab === 'pages' ? 'text-[#58A6FF]' : 'text-[#8B949E] hover:text-[#C9D1D9]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <BookOpen size={14} />
                      <span>Extracted Pages ({extractedPdf.totalPages})</span>
                    </div>
                    {modalTab === 'pages' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#58A6FF]" />}
                  </button>
                  <button
                    onClick={() => setModalTab('chunks')}
                    className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider relative transition-all ${
                      modalTab === 'chunks' ? 'text-[#58A6FF]' : 'text-[#8B949E] hover:text-[#C9D1D9]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Layers size={14} />
                      <span>RAG Chunks ({extractedPdf.chunks?.length || 0})</span>
                    </div>
                    {modalTab === 'chunks' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#58A6FF]" />}
                  </button>
                  <button
                    onClick={() => setModalTab('search')}
                    className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider relative transition-all ${
                      modalTab === 'search' ? 'text-[#58A6FF]' : 'text-[#8B949E] hover:text-[#C9D1D9]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Search size={14} />
                      <span>🔍 FAISS Vector Search</span>
                    </div>
                    {modalTab === 'search' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#58A6FF]" />}
                  </button>
                  <button
                    onClick={() => setModalTab('llama')}
                    className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider relative transition-all ${
                      modalTab === 'llama' ? 'text-[#58A6FF]' : 'text-[#8B949E] hover:text-[#C9D1D9]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[#58A6FF]" />
                      <span>🦙 Llama 3 RAG Q&A</span>
                    </div>
                    {modalTab === 'llama' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#58A6FF]" />}
                  </button>
                </div>
              )}

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#0D1117]/80">
                {isExtractingPdf ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-3">
                    <RefreshCw size={36} className="animate-spin text-[#58A6FF]" />
                    <h4 className="text-xs font-semibold text-[#C9D1D9]">Extracting & Chunking text with PyMuPDF (fitz)</h4>
                    <p className="text-[10px] text-[#8B949E] max-w-xs text-center">
                      Reading multi-page document streams, preserving physical layout, cleaning character markers, and splitting into 500-char chunks with 100-char overlap for RAG...
                    </p>
                  </div>
                ) : extractedPdf ? (
                  modalTab === 'pages' ? (
                    <div className="space-y-6">
                      {extractedPdf.pages.map((pageObj: any) => (
                        <div key={pageObj.page} className="bg-[#0D1117] border border-[#30363D] rounded-lg overflow-hidden">
                          {/* Page header banner */}
                          <div className="flex items-center justify-between px-4 py-2 bg-[#161B22] border-b border-[#30363D]">
                            <span className="text-[10px] font-mono font-bold text-[#58A6FF]">PAGE {pageObj.page} / {extractedPdf.totalPages}</span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(pageObj.text);
                                showToast(`Copied text from Page ${pageObj.page}!`);
                              }}
                              className="text-[10px] text-[#8B949E] hover:text-[#58A6FF] font-sans hover:underline"
                            >
                              Copy Page Text
                            </button>
                          </div>
                          {/* Page content */}
                          <div className="p-4 font-mono text-xs text-[#C9D1D9] whitespace-pre-wrap leading-relaxed select-text selection:bg-[#58A6FF]/30">
                            {pageObj.text ? pageObj.text : (
                              <span className="text-[#8B949E] italic">[Empty Page or Scanned Image without text layer]</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : modalTab === 'chunks' ? (
                    <div className="space-y-6">
                      {/* Explanatory banner */}
                      <div className="p-3.5 bg-blue-950/20 border border-blue-900/30 rounded-xl flex items-start gap-2.5">
                        <Database className="text-blue-400 mt-0.5 shrink-0" size={16} />
                        <div className="space-y-1">
                          <h4 className="text-xs font-semibold text-white">Retrieval-Augmented Generation (RAG) Ready</h4>
                          <p className="text-[10px] text-[#8B949E] leading-relaxed">
                            Text has been divided into semantic blocks of exactly <strong>500 characters</strong> with an overlap of <strong>100 characters</strong> between adjacent chunks. This preserves structural coherence, keeps context complete across page boundaries, and includes rich page and file metadata blocks ready to index into PostgreSQL or vector search.
                          </p>
                        </div>
                      </div>

                      {/* Chunks List */}
                      {(!extractedPdf.chunks || extractedPdf.chunks.length === 0) ? (
                        <div className="text-center py-12 bg-[#0D1117] border border-[#30363D] rounded-lg">
                          <Layers className="mx-auto text-[#30363D] mb-2" size={32} />
                          <h4 className="text-xs font-medium text-[#8B949E]">No RAG Chunks Generated</h4>
                          <p className="text-[10px] text-[#8B949E]/60 mt-1">This document does not contain any clean printable text characters to chunk.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {extractedPdf.chunks.map((ch: any) => (
                            <div key={ch.chunkId} className="bg-[#0D1117] border border-[#30363D] rounded-lg overflow-hidden flex flex-col">
                              {/* Chunk header */}
                              <div className="flex items-center justify-between px-4 py-2 bg-[#161B22] border-b border-[#30363D]">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono font-bold text-[#58A6FF] bg-[#58A6FF]/10 px-2 py-0.5 rounded border border-[#58A6FF]/20">
                                    CHUNK #{ch.chunkId}
                                  </span>
                                  <span className="text-[10px] text-[#8B949E]">
                                    Page {ch.page} • Chars: <span className="text-[#C9D1D9] font-mono font-bold">{ch.length}</span>
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(ch.text);
                                    showToast(`Copied text of Chunk #${ch.chunkId}!`);
                                  }}
                                  className="text-[10px] text-[#8B949E] hover:text-[#58A6FF] font-sans hover:underline"
                                >
                                  Copy Chunk
                                </button>
                              </div>

                              {/* Chunk body */}
                              <div className="p-4 font-mono text-xs text-[#C9D1D9] whitespace-pre-wrap leading-relaxed select-text selection:bg-[#58A6FF]/30 border-b border-[#30363D]/40 bg-[#0D1117]/50">
                                {ch.text}
                              </div>

                              {/* Embedding Vector Showcase */}
                              {ch.embedding ? (
                                <div className="px-4 py-3 bg-[#1F242C]/40 border-b border-[#30363D]/40 flex flex-col gap-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                      <span className="text-[10px] font-semibold text-white">Dense Vector Embedding</span>
                                      <span className="text-[9px] text-[#8B949E] bg-[#21262D] border border-[#30363D] px-1.5 py-0.2 rounded font-mono">
                                        {ch.embeddingModel || 'all-MiniLM-L6-v2'} ({ch.embeddingDimension || ch.embedding.length}d)
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(JSON.stringify(ch.embedding));
                                        showToast(`Copied ${ch.embedding.length}-dim vector floats to clipboard!`);
                                      }}
                                      className="text-[9px] text-[#58A6FF] hover:underline flex items-center gap-1"
                                    >
                                      Copy Raw Vector
                                    </button>
                                  </div>

                                  {/* Visual Sparkline of Vector Densities */}
                                  <div className="flex items-center gap-0.5 h-3 bg-[#0D1117] rounded border border-[#30363D]/60 px-1 overflow-hidden" title="Sparkline representing model weight vectors">
                                    {ch.embedding.slice(0, 72).map((val: number, idx: number) => {
                                      // Scale weight to display percentage (MiniLM weights are usually between -0.2 and 0.2)
                                      const normalizedVal = Math.min(Math.max((val + 0.15) / 0.3, 0), 1) * 100;
                                      return (
                                        <div
                                          key={idx}
                                          className="flex-1 h-full rounded-sm"
                                          style={{
                                            backgroundColor: val >= 0 
                                              ? `rgba(56, 189, 248, ${Math.max(val * 4, 0.1)})` // Cyan/Blue for positive dimensions
                                              : `rgba(244, 63, 94, ${Math.max(Math.abs(val) * 4, 0.1)})` // Rose/Red for negative dimensions
                                          }}
                                        />
                                      );
                                    })}
                                    <div className="text-[8px] text-[#8B949E] font-mono pl-1 shrink-0 bg-[#0D1117]">
                                      +{(ch.embedding.length - 72)} more dims
                                    </div>
                                  </div>

                                  {/* Excerpt list */}
                                  <p className="text-[9px] text-[#8B949E] font-mono truncate">
                                    Vector: <span className="text-emerald-400">[{ch.embedding.slice(0, 6).map((n: number) => n.toFixed(5)).join(', ')}, ...]</span>
                                  </p>
                                </div>
                              ) : ch.embeddingWarning ? (
                                <div className="px-4 py-2.5 bg-amber-950/20 border-b border-[#30363D]/40 text-[10px] text-amber-300 flex items-start gap-2">
                                  <span className="text-amber-400 shrink-0 mt-0.5 font-bold">⚠️</span>
                                  <div className="space-y-0.5">
                                    <p className="font-semibold">Embedding Pending/Not Configured</p>
                                    <p className="text-[9px] text-amber-400/80">{ch.embeddingWarning}</p>
                                  </div>
                                </div>
                              ) : null}

                              {/* Chunk metadata footer */}
                              <div className="px-4 py-2.5 bg-[#161B22]/30 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#8B949E]">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="flex items-center gap-1 font-sans">
                                    <Database size={10} className="text-purple-400" />
                                    <span>RAG Meta:</span>
                                  </span>
                                  <span className="bg-[#21262D] px-2 py-0.5 rounded text-[9px] font-mono border border-[#30363D]">
                                    fileName: {ch.metadata.fileName}
                                  </span>
                                  <span className="bg-[#21262D] px-2 py-0.5 rounded text-[9px] font-mono border border-[#30363D]">
                                    pageNumber: {ch.metadata.pageNumber}
                                  </span>
                                  <span className="bg-[#21262D] px-2 py-0.5 rounded text-[9px] font-mono border border-[#30363D]">
                                    overlap: {ch.metadata.overlap}
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(JSON.stringify(ch.metadata, null, 2));
                                    showToast(`Copied JSON metadata for Chunk #${ch.chunkId}!`);
                                  }}
                                  className="text-[9px] text-[#58A6FF] hover:underline"
                                >
                                  Copy JSON Block
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : modalTab === 'search' ? (
                    /* FAISS Similarity Search Tab */
                    <div className="space-y-6">
                      {/* Search Header Banner */}
                      <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl flex items-start gap-3 animate-fade-in">
                        <Database className="text-emerald-400 mt-0.5 shrink-0" size={18} />
                        <div className="space-y-1">
                          <h4 className="text-xs font-semibold text-white">FAISS Dense Vector Index Search Enabled</h4>
                          <p className="text-[10px] text-[#8B949E] leading-relaxed font-sans">
                            Search the document chunks using <strong>FAISS (Facebook AI Similarity Search)</strong> and the <strong>all-MiniLM-L6-v2</strong> sentence transformer. Type a question or medical phrase below to rank the top 5 most semantically relevant contexts using normalized cosine similarity scores.
                          </p>
                        </div>
                      </div>

                      {/* Query Input Box */}
                      <div className="bg-[#0D1117] border border-[#30363D] p-4 rounded-xl flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-2.5 text-[#8B949E]" size={16} />
                          <input
                            type="text"
                            value={vectorSearchQuery}
                            onChange={(e) => setVectorSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleVectorSimilaritySearch();
                              }
                            }}
                            placeholder="Enter medical terms or natural language questions... (e.g., 'What were the patient symptoms?')"
                            className="w-full bg-[#161B22] border border-[#30363D] rounded-lg pl-9 pr-4 py-2 text-xs text-[#C9D1D9] placeholder-[#8B949E] focus:outline-none focus:border-[#58A6FF] transition-all"
                          />
                        </div>
                        <button
                          onClick={handleVectorSimilaritySearch}
                          disabled={isSearchingVector || !vectorSearchQuery.trim()}
                          className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#238636]/50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all min-w-[150px]"
                        >
                          {isSearchingVector ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>Searching...</span>
                            </>
                          ) : (
                            <>
                              <Search size={14} />
                              <span>Search Vector Index</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Search Results */}
                      {isSearchingVector ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-3 bg-[#0D1117]/40 rounded-xl border border-[#30363D]/40">
                          <RefreshCw size={28} className="animate-spin text-[#58A6FF]" />
                          <h4 className="text-xs font-semibold text-[#C9D1D9]">Querying FAISS flat index...</h4>
                          <p className="text-[10px] text-[#8B949E] max-w-xs text-center font-mono">
                            all-MiniLM-L6-v2 transformer compiling dense tensor vectors & ranking dot-products...
                          </p>
                        </div>
                      ) : vectorSearchResults ? (
                        <div className="space-y-4 animate-fade-in">
                          <div className="flex items-center justify-between text-[11px] text-[#8B949E] px-1 font-sans">
                            <span>Query: <strong className="text-white">"{vectorSearchResults.query}"</strong></span>
                            <span>Top {vectorSearchResults.results?.length || 0} Matches found in {vectorSearchResults.totalChunksSearched} chunks</span>
                          </div>

                          {(!vectorSearchResults.results || vectorSearchResults.results.length === 0) ? (
                            <div className="text-center py-12 bg-[#0D1117] border border-[#30363D] rounded-lg">
                              <Layers className="mx-auto text-[#30363D] mb-2" size={32} />
                              <h4 className="text-xs font-medium text-[#8B949E]">No matching chunks found</h4>
                              <p className="text-[10px] text-[#8B949E]/60 mt-1">Try broadening your medical terms or query keywords.</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {vectorSearchResults.results.map((resObj: any, idx: number) => {
                                // Dynamic color based on similarity score
                                const score = resObj.similarityScore;
                                let scoreColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                                if (score < 0.4) {
                                  scoreColor = "text-[#8B949E] bg-[#21262D] border-[#30363D]";
                                } else if (score < 0.65) {
                                  scoreColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
                                }

                                return (
                                  <div key={idx} className="bg-[#0D1117] border border-[#30363D] rounded-lg overflow-hidden flex flex-col">
                                    {/* Match Header */}
                                    <div className="flex items-center justify-between px-4 py-2 bg-[#161B22] border-b border-[#30363D]">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-mono font-bold text-[#58A6FF] bg-[#58A6FF]/10 px-2 py-0.5 rounded border border-[#58A6FF]/20">
                                          MATCH #{idx + 1}
                                        </span>
                                        <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded border ${scoreColor}`}>
                                          Cosine Sim: {score.toFixed(4)}
                                        </span>
                                        <span className="text-[10px] text-[#8B949E]">
                                          Page {resObj.page} • Chunk #{resObj.chunkId}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(resObj.text);
                                          showToast(`Copied match #${idx + 1} text!`);
                                        }}
                                        className="text-[10px] text-[#8B949E] hover:text-[#58A6FF] font-sans hover:underline"
                                      >
                                        Copy Text
                                      </button>
                                    </div>

                                    {/* Match Text Content */}
                                    <div className="p-4 font-mono text-xs text-[#C9D1D9] whitespace-pre-wrap leading-relaxed select-text selection:bg-[#58A6FF]/30 bg-[#0D1117]/50 border-b border-[#30363D]/30">
                                      {resObj.text}
                                    </div>

                                    {/* Match Metadata footer */}
                                    <div className="px-4 py-2.5 bg-[#161B22]/30 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#8B949E]">
                                      <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1 font-sans text-[9px]">
                                          <Database size={10} className="text-purple-400" />
                                          <span>Index Meta:</span>
                                        </span>
                                        <span className="bg-[#21262D] px-2 py-0.5 rounded text-[8px] font-mono border border-[#30363D]">
                                          fileName: {resObj.metadata?.fileName}
                                        </span>
                                        <span className="bg-[#21262D] px-2 py-0.5 rounded text-[8px] font-mono border border-[#30363D]">
                                          page: {resObj.metadata?.pageNumber}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-16 bg-[#0D1117]/20 border border-dashed border-[#30363D] rounded-xl flex flex-col items-center justify-center space-y-2">
                          <Search className="text-[#30363D] mb-1" size={28} />
                          <h4 className="text-xs font-semibold text-[#8B949E]">Ready to search vector embeddings</h4>
                          <p className="text-[10px] text-[#8B949E]/70 max-w-sm">
                            Query search terms to perform high-speed cosine similarity lookup across all parsed semantic document chunks using our local FAISS indexes.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Llama 3 RAG Q&A Tab */
                    <div className="space-y-4">
                      {/* Llama Banner */}
                      <div className="p-4 bg-purple-950/20 border border-purple-900/30 rounded-xl flex items-start gap-3 animate-fade-in">
                        <Sparkles className="text-purple-400 mt-0.5 shrink-0" size={18} />
                        <div className="space-y-1">
                          <h4 className="text-xs font-semibold text-white">🦙 Meta Llama 3 • Context-Constrained Q&A</h4>
                          <p className="text-[10px] text-[#8B949E] leading-relaxed font-sans">
                            Ask Llama 3 any question about this document. Our pipeline will automatically perform a semantic vector search, pull the top 5 most relevant context chunks, and prompt Llama 3 to answer <strong>strictly and only</strong> using that information with explicit page citations.
                          </p>
                        </div>
                      </div>

                      {/* Llama Settings and Key Configuration */}
                      <div className="bg-[#0D1117] border border-[#30363D] p-3 rounded-xl space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-[#30363D]/60">
                          <div className="space-y-0.5">
                            <h4 className="text-[11px] font-semibold text-white">RAG Engine Configuration</h4>
                            <p className="text-[9px] text-[#8B949E]">Choose a Llama 3 service provider and enter your API keys securely.</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <select
                              value={llamaProvider}
                              onChange={(e: any) => setLlamaProvider(e.target.value)}
                              className="bg-[#161B22] border border-[#30363D] rounded-lg px-2.5 py-1 text-[11px] text-[#C9D1D9] focus:outline-none focus:border-[#58A6FF]"
                            >
                              <option value="gemini_fallback">🌐 Workspace Gemini (No Key Needed)</option>
                              <option value="groq">⚡ Groq Cloud (llama3-8b)</option>
                              <option value="huggingface">🤗 Hugging Face (llama-3-8b-instruct)</option>
                              <option value="openrouter">🚀 OpenRouter (llama-3-8b-instruct)</option>
                            </select>
                          </div>
                        </div>

                        {llamaProvider !== 'gemini_fallback' && (
                          <div className="space-y-1.5 animate-fade-in">
                            <label className="text-[9px] text-[#8B949E] block font-semibold uppercase tracking-wider">
                              {llamaProvider === 'groq' ? 'Groq API Key' : llamaProvider === 'huggingface' ? 'Hugging Face User Access Token' : 'OpenRouter API Key'}
                            </label>
                            <input
                              type="password"
                              value={llamaApiKey}
                              onChange={(e) => setLlamaApiKey(e.target.value)}
                              placeholder={`Paste your ${llamaProvider === 'groq' ? 'gsk_...' : llamaProvider === 'huggingface' ? 'hf_...' : 'sk-or-...'} API key here`}
                              className="w-full bg-[#161B22] border border-[#30363D] rounded-lg px-2.5 py-1 text-xs text-[#C9D1D9] placeholder-[#8B949E]/70 focus:outline-none focus:border-[#58A6FF]"
                            />
                            <p className="text-[9px] text-[#8B949E] leading-relaxed">
                              Your API key is transmitted purely server-side and never exposed to the client browser. You can also define <code>GROQ_API_KEY</code>, <code>HF_API_KEY</code>, or <code>OPENROUTER_API_KEY</code> in your environment.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* ChatGPT-style Layout */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-h-[480px]">
                        {/* Sidebar: Conversations Panel */}
                        <div className="md:col-span-1 bg-[#0D1117]/40 border border-[#30363D] rounded-xl p-3 flex flex-col gap-3">
                          <button
                            onClick={createNewLlamaChat}
                            className="w-full px-3 py-2 bg-purple-600/90 hover:bg-purple-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-98"
                          >
                            <Plus size={13} />
                            <span>New Conversation</span>
                          </button>

                          <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[360px] pr-1">
                            <span className="text-[9px] uppercase font-bold tracking-wider text-[#8B949E] px-1 block mb-1">
                              History ({llamaChats.length})
                            </span>
                            {llamaChats.length === 0 ? (
                              <div className="text-center py-8 text-[10px] text-[#8B949E] italic">
                                No conversations yet
                              </div>
                            ) : (
                              llamaChats.map((chat) => {
                                const isActive = chat.id === activeLlamaChatId;
                                const isRenaming = chat.id === renamingChatId;

                                return (
                                  <div
                                    key={chat.id}
                                    className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                                      isActive
                                        ? 'bg-purple-950/20 border-purple-800/40 text-purple-400 font-semibold'
                                        : 'bg-transparent border-transparent text-[#8B949E] hover:bg-[#161B22]/50 hover:text-[#C9D1D9]'
                                    }`}
                                    onClick={() => !isRenaming && setActiveLlamaChatId(chat.id)}
                                  >
                                    {isRenaming ? (
                                      <input
                                        type="text"
                                        value={renamingChatTitle}
                                        onChange={(e) => setRenamingChatTitle(e.target.value)}
                                        onBlur={() => {
                                          if (renamingChatTitle.trim()) {
                                            const updated = llamaChats.map(c => 
                                              c.id === chat.id ? { ...c, title: renamingChatTitle.trim() } : c
                                            );
                                            setLlamaChats(updated);
                                            localStorage.setItem(`llama_chats_pdf_${selectedPdfIdForSearch}`, JSON.stringify(updated));
                                          }
                                          setRenamingChatId(null);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.currentTarget.blur();
                                          } else if (e.key === 'Escape') {
                                            setRenamingChatId(null);
                                          }
                                        }}
                                        className="w-full bg-[#161B22] border border-purple-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      <span 
                                        className="truncate pr-1 select-none flex-1"
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          setRenamingChatId(chat.id);
                                          setRenamingChatTitle(chat.title);
                                        }}
                                        title="Double click to rename"
                                      >
                                        {chat.title}
                                      </span>
                                    )}

                                    {!isRenaming && (
                                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setRenamingChatId(chat.id);
                                            setRenamingChatTitle(chat.title);
                                          }}
                                          className="p-0.5 hover:bg-[#30363D] rounded text-[#8B949E] hover:text-white"
                                          title="Rename"
                                        >
                                          <span className="text-[10px]">✏️</span>
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteLlamaChat(chat.id);
                                          }}
                                          className="p-0.5 hover:bg-red-950/40 rounded text-[#8B949E] hover:text-red-400"
                                          title="Delete"
                                        >
                                          <Trash2 size={11} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Main Chat Interface Area */}
                        <div className="md:col-span-3 flex flex-col h-[480px] bg-[#0D1117]/60 border border-[#30363D] rounded-xl overflow-hidden">
                          {/* Chat Header */}
                          <div className="px-4 py-2 bg-[#161B22]/80 border-b border-[#30363D] flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                CHAT
                              </span>
                              <span className="text-xs font-semibold text-white truncate max-w-[180px]">
                                {llamaChats.find(c => c.id === activeLlamaChatId)?.title || 'No Conversation Active'}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#8B949E]">
                              Model: Llama 3 8B
                            </span>
                          </div>

                          {/* Chat Messages */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0D1117]/30 font-sans">
                            {(() => {
                              const activeChat = llamaChats.find(c => c.id === activeLlamaChatId);
                              if (!activeChat || activeChat.messages.length === 0) {
                                return (
                                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                                    <Sparkles className="text-[#30363D]" size={36} />
                                    <h4 className="text-xs font-semibold text-[#8B949E]">Start clinical query dialogue</h4>
                                    <p className="text-[10px] text-[#8B949E]/70 max-w-xs">
                                      Ask Llama 3 any technical questions about diagnosis metrics, page summaries, or lab parameters in this document.
                                    </p>
                                  </div>
                                );
                              }

                              return (
                                <>
                                  {activeChat.messages.map((msg) => {
                                    if (msg.role === 'user') {
                                      return (
                                        <div key={msg.id} className="flex flex-col items-end gap-1 select-text">
                                          <div className="bg-purple-950/20 border border-purple-900/40 text-[#C9D1D9] rounded-2xl rounded-tr-none px-4 py-2 text-xs max-w-[85%] shadow-sm">
                                            {msg.content}
                                          </div>
                                          <span className="text-[8px] text-[#8B949E] px-1">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div key={msg.id} className="flex flex-col items-start gap-1 w-full">
                                          <ChatMessageItem msg={msg} showToast={showToast} />
                                          <span className="text-[8px] text-[#8B949E] pl-10">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                      );
                                    }
                                  })}
                                </>
                              );
                            })()}

                            {/* Typing Indicator */}
                            {isLlamaQuerying && (
                              <div className="flex items-start gap-2.5 max-w-[90%] animate-pulse">
                                <div className="w-7 h-7 rounded-full bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400 shrink-0 text-xs">
                                  🦙
                                </div>
                                <div className="bg-[#161b22] border border-[#30363D] rounded-2xl rounded-tl-none px-4 py-3 text-xs text-[#C9D1D9] shadow-sm flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                  </div>
                                  <span className="text-[10px] text-[#8B949E] italic">Llama 3 is retrieving context & thinking...</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Message input */}
                          <div className="p-3 border-t border-[#30363D] bg-[#0D1117]/90 flex gap-2 shrink-0">
                            <input
                              type="text"
                              value={llamaQuery}
                              onChange={(e) => setLlamaQuery(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !isLlamaQuerying && llamaQuery.trim()) {
                                  sendLlamaMessage(llamaQuery);
                                }
                              }}
                              disabled={isLlamaQuerying}
                              placeholder="Ask Llama 3 about this document... (e.g. 'Summarize page 3 tables')"
                              className="flex-1 bg-[#161B22] border border-[#30363D] rounded-lg px-3 py-2 text-xs text-[#C9D1D9] placeholder-[#8B949E]/70 focus:outline-none focus:border-purple-500 disabled:opacity-50 transition-all"
                            />
                            <button
                              onClick={() => sendLlamaMessage(llamaQuery)}
                              disabled={isLlamaQuerying || !llamaQuery.trim()}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all"
                            >
                              {isLlamaQuerying ? (
                                <>
                                  <RefreshCw size={12} className="animate-spin" />
                                  <span>Querying...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles size={12} />
                                  <span>Ask</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-center py-10 text-xs text-[#8B949E]">
                    Failed to load extracted document data.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[#30363D] bg-[#0D1117] flex items-center justify-between rounded-b-xl text-[10px] text-[#8B949E]">
                <span className="flex items-center gap-1">
                  <Shield className="text-emerald-500" size={12} />
                  <span>Compliant secure memory sandbox execution</span>
                </span>
                {extractedPdf && (
                  <button
                    onClick={() => {
                      const fullText = extractedPdf.pages.map((p: any) => `--- PAGE ${p.page} ---\n${p.text}`).join('\n\n');
                      navigator.clipboard.writeText(fullText);
                      showToast('Copied full document text!');
                    }}
                    className="px-3 py-1 bg-[#238636] hover:bg-[#2ea043] text-white border border-[#2ea043] text-xs font-semibold rounded transition-all"
                  >
                    Copy Full Document
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
