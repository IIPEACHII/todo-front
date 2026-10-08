import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, Circle, Trash2, Plus, Clock, Settings, RefreshCw, 
  AlertCircle, Sparkles, Server, Check, X, Search, Edit2, 
  ArrowUpDown, LogOut, User as UserIcon, Lock, Mail, ArrowRight, Leaf
} from 'lucide-react';

const getInitialApiUrl = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  return 'http://localhost:5000';
};

export default function App() {
  // Auth State
  const [token, setToken] = useState(localStorage.getItem('taskflow_token') || null);
  const [currentUser, setCurrentUser] = useState(localStorage.getItem('taskflow_user') || null);
  const [isAuthMode, setIsAuthMode] = useState('login'); // 'login' | 'register'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Todo State
  const [todos, setTodos] = useState([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [filter, setFilter] = useState('all'); 
  const [sortBy, setSortBy] = useState('newest'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  // Settings & Network State
  const [apiUrl, setApiUrl] = useState(getInitialApiUrl);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingApiUrl, setPendingApiUrl] = useState(getInitialApiUrl);
  const [isLoading, setIsLoading] = useState(false);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  });

  // Authentication Handler
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    const endpoint = isAuthMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setToken(data.token);
      setCurrentUser(data.email);
      localStorage.setItem('taskflow_token', data.token);
      localStorage.setItem('taskflow_user', data.email);
      setAuthPassword('');
      setAuthEmail('');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser(null);
    setTodos([]);
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_user');
  };

  // Fetch Todos
  const fetchTodos = async (targetUrl = apiUrl) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${targetUrl.replace(/\/$/, '')}/api/todos`, {
        method: 'GET',
        headers: getHeaders(),
      });

      if (response.status === 401) {
        handleLogout();
        throw new Error('Session expired');
      }

      if (!response.ok) throw new Error('Failed to fetch data');

      const data = await response.json();
      setTodos(data);
    } catch (err) {
      console.warn('Backend issue:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchTodos(apiUrl);
  }, [apiUrl, token]);

  // Add Todo
  const handleAddTodo = async (e) => {
    e.preventDefault();
    const trimmed = newTodoText.trim();
    if (!trimmed) return;

    const tempId = `local-${Date.now()}`;
    const newTodo = { _id: tempId, text: trimmed, completed: false, createdAt: new Date().toISOString() };
    setTodos((prev) => [newTodo, ...prev]);
    setNewTodoText('');

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ text: trimmed }),
      });

      if (response.status === 401) return handleLogout();
      if (!response.ok) throw new Error('Failed to create on server');
      
      const savedTodo = await response.json();
      setTodos((prev) => prev.map((t) => (t._id === tempId ? savedTodo : t)));
    } catch (err) {
      console.error('Error saving todo:', err);
      setTodos((prev) => prev.filter((t) => t._id !== tempId));
    }
  };

  // Toggle Todo Status
  const handleToggleTodo = async (todo) => {
    const updatedStatus = !todo.completed;
    setTodos((prev) => prev.map((t) => (t._id === todo._id ? { ...t, completed: updatedStatus } : t)));

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos/${todo._id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ completed: updatedStatus }),
      });
      if (response.status === 401) handleLogout();
    } catch (err) {
      setTodos((prev) => prev.map((t) => (t._id === todo._id ? { ...t, completed: todo.completed } : t)));
    }
  };

  // Edit Todo
  const handleStartEdit = (todo) => {
    setEditingId(todo._id);
    setEditingText(todo.text);
  };

  const handleSaveEdit = async (id) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;

    const previousTodos = [...todos];
    setTodos((prev) => prev.map((t) => t._id === id ? { ...t, text: trimmed, updatedAt: new Date().toISOString() } : t));
    setEditingId(null);

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ text: trimmed }),
      });
      if (response.status === 401) handleLogout();
      if (!response.ok) throw new Error('Update failed');
    } catch (err) {
      setTodos(previousTodos);
    }
  };

  // Delete Todo
  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    const targetId = deleteCandidate._id;
    setTodos((prev) => prev.filter((t) => t._id !== targetId));
    setDeleteCandidate(null);

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/todos/${targetId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (response.status === 401) handleLogout();
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const formatDateTime = (isoDate) => {
    if (!isoDate) return '';
    try {
      return new Date(isoDate).toLocaleString('th-TH', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  };

  // Filter & Sort Logic
  const filteredTodos = useMemo(() => {
    const result = todos.filter((todo) => {
      const matchesFilter = filter === 'all' ? true : filter === 'active' ? !todo.completed : todo.completed;
      const matchesSearch = todo.text.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      if (sortBy === 'az') return a.text.localeCompare(b.text, undefined, { sensitivity: 'base' });
      if (sortBy === 'za') return b.text.localeCompare(a.text, undefined, { sensitivity: 'base' });
      if (sortBy === 'status') return Number(a.completed) - Number(b.completed);
      return 0;
    });
  }, [todos, filter, searchQuery, sortBy]);

  // Statistics
  const totalTasks = todos.length;
  const completedTasks = todos.filter(t => t.completed).length;
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  // Login / Register Screen (Botanical Theme)
  if (!token) {
    return (
      <div className="min-h-screen bg-[#2A3828] text-[#D1EDD3] flex flex-col items-center justify-center p-4 relative selection:bg-[#ACC5A6] selection:text-[#2A3828]">
        
        {/* Settings button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          title="API Configuration"
          className="absolute top-6 right-6 p-2.5 rounded-xl bg-[#5C7057]/30 border border-[#ACC5A6]/20 text-[#ACC5A6] hover:text-[#D1EDD3] transition"
        >
          <Settings className="w-5 h-5" />
        </button>

        <div className="w-full max-w-sm bg-[#5C7057]/20 border border-[#ACC5A6]/20 p-8 rounded-3xl shadow-2xl backdrop-blur-md">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-[#89A482] rounded-2xl shadow-lg shadow-[#89A482]/20 text-[#2A3828]">
              <Leaf className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-[#D1EDD3] mb-1 tracking-wide">
            AuraTask
          </h1>
          <p className="text-center text-[#ACC5A6] text-xs mb-6">
            {isAuthMode === 'login' ? 'เข้าสู่ระบบเพื่อซิงค์ข้อมูลงานของคุณ' : 'สร้างบัญชีผู้ใช้ใหม่'}
          </p>

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            {authError && (
              <div className="bg-rose-900/30 border border-rose-500/30 text-rose-200 text-xs p-3 rounded-xl flex gap-2 items-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#89A482]" />
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="อีเมล"
                className="w-full bg-[#5C7057]/30 border border-[#ACC5A6]/30 rounded-xl pl-10 pr-4 py-3 text-sm text-[#D1EDD3] placeholder-[#89A482] focus:outline-none focus:border-[#ACC5A6]"
              />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#89A482]" />
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                className="w-full bg-[#5C7057]/30 border border-[#ACC5A6]/30 rounded-xl pl-10 pr-4 py-3 text-sm text-[#D1EDD3] placeholder-[#89A482] focus:outline-none focus:border-[#ACC5A6]"
              />
            </div>
            <button
              type="submit"
              disabled={isAuthLoading}
              className="mt-2 w-full bg-[#ACC5A6] hover:bg-[#D1EDD3] text-[#2A3828] rounded-xl py-3 text-sm font-semibold transition shadow-lg shadow-[#ACC5A6]/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAuthLoading ? 'กำลังดำเนินการ...' : (isAuthMode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก')}
              {!isAuthLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 text-center text-xs">
            <span className="text-[#89A482]">
              {isAuthMode === 'login' ? "ยังไม่มีบัญชีใช่ไหม? " : "มีบัญชีอยู่แล้วใช่ไหม? "}
            </span>
            <button
              onClick={() => setIsAuthMode(isAuthMode === 'login' ? 'register' : 'login')}
              className="text-[#ACC5A6] hover:text-[#D1EDD3] font-medium transition underline underline-offset-2"
            >
              {isAuthMode === 'login' ? 'ลงทะเบียนที่นี่' : 'เข้าสู่ระบบ'}
            </button>
          </div>
        </div>

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#2A3828] border border-[#ACC5A6]/30 rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-[#D1EDD3]">
              <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-[#ACC5A6] hover:text-[#D1EDD3]">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Server className="w-5 h-5 text-[#ACC5A6]" /> ตั้งค่า API Backend
              </h2>
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-xs text-[#ACC5A6]">Backend URL</label>
                <input
                  type="text"
                  value={pendingApiUrl}
                  onChange={(e) => setPendingApiUrl(e.target.value)}
                  className="w-full bg-[#5C7057]/30 border border-[#ACC5A6]/30 rounded-xl px-3.5 py-2.5 text-xs text-[#D1EDD3] focus:outline-none focus:border-[#ACC5A6] font-mono"
                />
              </div>
              <div className="mt-6 flex justify-end gap-2.5">
                <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-xl text-xs text-[#ACC5A6] hover:bg-[#5C7057]/30">ยกเลิก</button>
                <button onClick={() => { setApiUrl(pendingApiUrl); setIsSettingsOpen(false); }} className="px-4 py-2 rounded-xl text-xs bg-[#ACC5A6] text-[#2A3828] font-semibold hover:bg-[#D1EDD3]">บันทึก</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main Dashboard (Botanical Palette Theme)
  return (
    <div className="min-h-screen bg-[#2A3828] text-[#D1EDD3] flex flex-col items-center py-8 px-4 sm:px-6 selection:bg-[#ACC5A6] selection:text-[#2A3828]">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        
        {/* Header Section */}
        <header className="flex flex-col gap-4 bg-[#5C7057]/20 border border-[#ACC5A6]/20 p-6 rounded-3xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#89A482] rounded-2xl shadow-lg shadow-[#89A482]/20 text-[#2A3828]">
                <Leaf className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-wide text-[#D1EDD3]">AuraTask</h1>
                <p className="text-xs text-[#ACC5A6]">ระบบจัดการงาน โทนสี Botanical</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => fetchTodos(apiUrl)} title="Refresh" className="p-2.5 rounded-xl bg-[#5C7057]/30 border border-[#ACC5A6]/20 text-[#ACC5A6] hover:text-[#D1EDD3] transition">
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#ACC5A6]' : ''}`} />
              </button>
              <button onClick={() => setIsSettingsOpen(true)} title="Settings" className="p-2.5 rounded-xl bg-[#5C7057]/30 border border-[#ACC5A6]/20 text-[#ACC5A6] hover:text-[#D1EDD3] transition">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* User Bar & Progress */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-[#ACC5A6]/10">
            <div className="flex items-center gap-2 text-xs text-[#ACC5A6]">
              <UserIcon className="w-3.5 h-3.5 text-[#ACC5A6]" />
              <span>เข้าสู่ระบบโดย <strong className="font-medium text-[#D1EDD3]">{currentUser}</strong></span>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto">
              {/* Progress Bar */}
              <div className="flex-1 sm:w-36 bg-[#5C7057]/40 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-[#ACC5A6] h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <span className="text-xs text-[#ACC5A6] font-medium">{progressPercent}%</span>

              <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-rose-300 hover:text-rose-200 transition ml-2">
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ออกจากระบบ</span>
              </button>
            </div>
          </div>
        </header>

        {/* Input Add Task Form */}
        <form onSubmit={handleAddTodo} className="relative">
          <div className="flex items-center gap-2 p-2 bg-[#5C7057]/30 border border-[#ACC5A6]/20 rounded-2xl shadow-xl focus-within:border-[#ACC5A6] transition-all">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="+ เพิ่มรายการงานใหม่วันนี้..."
              className="flex-1 bg-transparent px-4 py-2.5 text-[#D1EDD3] placeholder-[#89A482] text-sm focus:outline-none"
            />
            <button 
              type="submit" 
              disabled={!newTodoText.trim()} 
              className="px-5 py-2.5 rounded-xl bg-[#ACC5A6] hover:bg-[#D1EDD3] text-[#2A3828] font-semibold text-sm flex items-center gap-2 transition disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> <span>เพิ่ม</span>
            </button>
          </div>
        </form>

        {/* Filters, Sort & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center bg-[#5C7057]/30 border border-[#ACC5A6]/20 p-1 rounded-xl text-xs">
            {['all', 'active', 'completed'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg transition font-medium capitalize ${
                  filter === f ? 'bg-[#89A482] text-[#2A3828] shadow' : 'text-[#ACC5A6] hover:text-[#D1EDD3]'
                }`}
              >
                {f === 'all' ? 'ทั้งหมด' : f === 'active' ? 'กำลังทำ' : 'เสร็จแล้ว'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 sm:justify-end">
            <div className="flex items-center gap-1.5 bg-[#5C7057]/30 border border-[#ACC5A6]/20 rounded-xl px-2.5 py-1.5 text-xs text-[#ACC5A6]">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#ACC5A6]" />
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)} 
                className="bg-transparent text-[#D1EDD3] focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-[#2A3828]">ใหม่สุด</option>
                <option value="oldest" className="bg-[#2A3828]">เก่าสุด</option>
                <option value="az" className="bg-[#2A3828]">ก &rarr; ฮ / A &rarr; Z</option>
                <option value="za" className="bg-[#2A3828]">ฮ &rarr; ก / Z &rarr; A</option>
                <option value="status" className="bg-[#2A3828]">รอดำเนินการขึ้นก่อน</option>
              </select>
            </div>
            
            <div className="relative flex-1 max-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#89A482]" />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="ค้นหา..." 
                className="w-full bg-[#5C7057]/30 border border-[#ACC5A6]/20 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-[#D1EDD3] placeholder-[#89A482] focus:outline-none focus:border-[#ACC5A6]" 
              />
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="flex flex-col gap-2.5">
          {filteredTodos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-[#ACC5A6]/20 rounded-2xl bg-[#5C7057]/10 text-center">
              <CheckCircle2 className="w-8 h-8 text-[#89A482] mb-2" />
              <h3 className="text-sm font-medium text-[#D1EDD3]">ไม่พบรายการงาน</h3>
              <p className="text-xs text-[#89A482] mt-1">ไม่มีงานในเงื่อนไขการค้นหานี้</p>
            </div>
          ) : (
            filteredTodos.map((todo) => {
              const formattedDate = formatDateTime(todo.createdAt || todo.timestamp);
              const isEditing = editingId === todo._id;

              return (
                <div 
                  key={todo._id} 
                  className={`group flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                    todo.completed 
                      ? 'bg-[#5C7057]/15 border-[#ACC5A6]/10 opacity-60' 
                      : 'bg-[#5C7057]/30 border-[#ACC5A6]/20 hover:border-[#ACC5A6]/40'
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <button onClick={() => handleToggleTodo(todo)} disabled={isEditing} className="mt-0.5 text-[#89A482] hover:text-[#ACC5A6]">
                      {todo.completed ? <CheckCircle2 className="w-5 h-5 text-[#ACC5A6]" /> : <Circle className="w-5 h-5" />}
                    </button>
                    
                    <div className="flex flex-col gap-1 flex-1">
                      {isEditing ? (
                        <input
                          type="text" 
                          autoFocus 
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(todo._id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="bg-[#2A3828] border border-[#ACC5A6] rounded-lg px-2.5 py-1 text-sm text-[#D1EDD3] focus:outline-none"
                        />
                      ) : (
                        <p 
                          onDoubleClick={() => !todo.completed && handleStartEdit(todo)} 
                          className={`text-sm break-words ${todo.completed ? 'line-through text-[#89A482]' : 'text-[#D1EDD3]'}`}
                        >
                          {todo.text}
                        </p>
                      )}
                      
                      {formattedDate && !isEditing && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#89A482]">
                          <Clock className="w-3 h-3" /> {formattedDate} {todo.updatedAt && '(แก้ไขแล้ว)'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <button onClick={() => handleSaveEdit(todo._id)} className="p-1.5 text-[#ACC5A6] hover:bg-[#ACC5A6]/10 rounded-lg"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-[#89A482] hover:bg-[#5C7057]/30 rounded-lg"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleStartEdit(todo)} className="p-1.5 text-[#89A482] hover:text-[#ACC5A6] hover:bg-[#ACC5A6]/10 rounded-lg opacity-80 sm:opacity-0 group-hover:opacity-100"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setDeleteCandidate(todo)} className="p-1.5 text-[#89A482] hover:text-rose-300 hover:bg-rose-500/10 rounded-lg opacity-80 sm:opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#2A3828] border border-[#ACC5A6]/30 rounded-2xl w-full max-w-md p-6 relative text-[#D1EDD3]">
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-[#ACC5A6] hover:text-[#D1EDD3]"><X className="w-5 h-5" /></button>
            <h2 className="text-lg font-semibold flex items-center gap-2"><Server className="w-5 h-5 text-[#ACC5A6]" /> ตั้งค่า API Backend</h2>
            <div className="mt-4"><input type="text" value={pendingApiUrl} onChange={(e) => setPendingApiUrl(e.target.value)} className="w-full bg-[#5C7057]/30 border border-[#ACC5A6]/30 rounded-xl px-3.5 py-2.5 text-xs text-[#D1EDD3] font-mono focus:outline-none focus:border-[#ACC5A6]" /></div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-xl text-xs text-[#ACC5A6] hover:bg-[#5C7057]/30">ยกเลิก</button>
              <button onClick={() => { setApiUrl(pendingApiUrl); setIsSettingsOpen(false); }} className="px-4 py-2 rounded-xl text-xs bg-[#ACC5A6] text-[#2A3828] font-semibold hover:bg-[#D1EDD3]">บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#2A3828] border border-[#ACC5A6]/30 rounded-2xl w-full max-w-sm p-6 text-[#D1EDD3]">
            <h3 className="font-semibold mb-2">ยืนยันการลบงาน?</h3>
            <p className="text-xs text-[#ACC5A6] mb-5">คุณต้องการลบรายการ "{deleteCandidate.text}" ใช่หรือไม่?</p>
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setDeleteCandidate(null)} className="px-3.5 py-2 rounded-xl text-xs text-[#ACC5A6] hover:bg-[#5C7057]/30">ยกเลิก</button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-xl text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium">ลบรายการ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}