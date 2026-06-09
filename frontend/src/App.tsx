import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Banknote,
  HandCoins,
  AlertTriangle,
  FileText,
  Settings,
  LogOut,
  Globe,
  Sun,
  Moon,
  X,
  FileSpreadsheet,
  Activity,
  Search,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { translations } from './utils/translation';
import { SpeedInsights } from '@vercel/speed-insights/react';
import type { Language } from './utils/translation';
import scanQrCodeImg from './assets/scanqrcode.jpg';

const API_BASE = 'http://localhost:5000/api';

interface User {
  id: number;
  username: string;
  role: 'super_admin' | 'admin' | 'staff' | 'customer' | 'family';
  name: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('sm_token'));
  const [user, setUser] = useState<User | null>(null);
  const [loginUsername, setLoginUsername] = useState(localStorage.getItem('sm_remembered_username') || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [signupForm, setSignupForm] = useState({ name: '', phone: '', password: '', confirmPassword: '', village_area: '', aadhaar: '', address: '' });
  
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  
  const [userManagementList, setUserManagementList] = useState<any[]>([]);
  const [selectedUserToReset, setSelectedUserToReset] = useState<any | null>(null);
  const [adminResetPassword, setAdminResetPassword] = useState('');

  const [currentView, setCurrentView] = useState<'dashboard' | 'customers' | 'loans' | 'collections' | 'defaulters' | 'reports' | 'settings' | 'customer_dashboard' | 'profile'>('dashboard');
  const [language, setLanguage] = useState<Language>('en');
  const [darkMode, setDarkMode] = useState<boolean>(localStorage.getItem('sm_theme') === 'dark');
  
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [inactiveCustomers, setInactiveCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<any>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState<any>({
    name: '', phone: '', alt_phone: '', address: '', village_area: '', aadhaar: '', pan: '', occupation: '',
    guarantor_name: '', guarantor_phone: '', guarantor_relation: '',
    photo: null, aadhaar_front: null, aadhaar_back: null, other_doc: null
  });

  // Soft Deletion Modal States
  const [customerToDelete, setCustomerToDelete] = useState<any | null>(null);
  const [deleteConfirmForm, setDeleteConfirmForm] = useState({ adminPassword: '', reason: '' });

  const [showAddLoan, setShowAddLoan] = useState(false);
  const [loanForm, setLoanForm] = useState({
    customer_id: '', amount: '', interest_rate: '2', interest_type: 'percentage' as 'flat' | 'percentage',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly', duration: '', processing_fee: '0', notes: ''
  });

  const [showPayModal, setShowPayModal] = useState<any | null>(null);
  const [paymentForm, setPaymentForm] = useState<any>({
    amount_collected: '', collected_date: new Date().toISOString().split('T')[0], payment_method: 'cash', remarks: '', utr: ''
  });

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({
    business_name: 'Sri Murugan Finance',
    business_address: 'Main Road, Villupuram',
    business_phone: '+91 9876543210',
    upi_id: 'srimuruganfinance@okicici',
    upi_account_name: 'Sri Murugan Finance',
    upi_bank_name: 'ICICI Bank',
    upi_merchant_name: 'Sri Murugan Finance'
  });
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', role: 'staff' as 'super_admin' | 'admin' | 'staff' | 'customer' | 'family', name: '' });
  
  const [customerSearch, setCustomerSearch] = useState('');
  const [reportType, setReportType] = useState<'collections' | 'defaulters' | 'outstanding'>('collections');
  const [reportStartDate, setReportStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [_reportData, setReportData] = useState<any[]>([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const speakTamil = (phrase: string) => {
    if (!voiceEnabled) return;
    try {
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.lang = 'ta-IN';
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Tamil TTS failed', e);
    }
  };

  const t = translations[language];

  // Instant Customer Search
  useEffect(() => {
    if (token && user) {
      fetchCustomers();
    }
  }, [customerSearch]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('sm_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('sm_theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('sm_token', token);
      fetchUser();
    } else {
      localStorage.removeItem('sm_token');
      setUser(null);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      if (user.role !== 'customer') {
        fetchDashboard();
        fetchCustomers();
      }
      fetchLoans();
      fetchCollections();
      fetchSettings();
      if (['super_admin', 'admin', 'family'].includes(user.role)) {
        fetchBackups();
        fetchAuditLogs();
        fetchInactiveCustomers();
        fetchUsersList();
      }
    }
  }, [user, currentView]);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerDetail(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  const fetchUsersList = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setUserManagementList(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        if (data.user) {
          if (data.user.role === 'customer') {
            setCurrentView('customer_dashboard');
          } else if (data.user.role === 'staff') {
            setCurrentView('loans');
          } else {
            setCurrentView('dashboard');
          }
        }
      } else {
        setToken(null);
      }
    } catch {
      setToken(null);
    }
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/reports/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setDashboardData(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_BASE}/customers?search=${customerSearch}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCustomers(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchInactiveCustomers = async () => {
    try {
      const res = await fetch(`${API_BASE}/customers?include_inactive=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInactiveCustomers(data.filter((c: any) => c.is_active === 0));
      }
    } catch (err) { console.error(err); }
  };

  const fetchCustomerDetail = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/customers/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCustomerDetail(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchLoans = async () => {
    try {
      const res = await fetch(`${API_BASE}/loans`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setLoans(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchCollections = async () => {
    try {
      const res = await fetch(`${API_BASE}/collections`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCollections(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings/backups`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setBackups(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings((prev: any) => ({ ...prev, ...data }));
      }
    } catch (err) { console.error(err); }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        alert('Settings updated successfully');
        fetchSettings();
      } else {
        alert('Failed to update settings');
      }
    } catch {
      alert('Error updating settings');
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings/audit-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setAuditLogs(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok) {
        if (rememberMe) {
          localStorage.setItem('sm_remembered_username', loginUsername);
        } else {
          localStorage.removeItem('sm_remembered_username');
        }
        setToken(data.token);
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch {
      setLoginError('Could not connect to API server.');
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    Object.entries(customerForm).forEach(([key, val]) => {
      formData.append(key, val);
    });

    try {
      const res = await fetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        setShowAddCustomer(false);
        setCustomerForm({
          name: '', phone: '', alt_phone: '', address: '', village_area: '', aadhaar: '', pan: '', occupation: '',
          guarantor_name: '', guarantor_phone: '', guarantor_relation: '',
          photo: null, aadhaar_front: null, aadhaar_back: null, other_doc: null
        });
        fetchCustomers();
        speakTamil("வாடிக்கையாளர் வெற்றிகரமாக சேர்க்கப்பட்டார்");
        alert('Customer added successfully');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add customer');
      }
    } catch {
      alert('Error adding customer');
    }
  };

  const handleSoftDeleteCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerToDelete) return;
    try {
      const res = await fetch(`${API_BASE}/customers/${customerToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(deleteConfirmForm)
      });
      if (res.ok) {
        setCustomerToDelete(null);
        setDeleteConfirmForm({ adminPassword: '', reason: '' });
        setSelectedCustomerId(null);
        fetchCustomers();
        fetchInactiveCustomers();
        alert('Customer soft-deleted successfully');
      } else {
        const data = await res.json();
        alert(data.error || 'Password validation failed');
      }
    } catch {
      alert('Error deleting customer');
    }
  };

  const handleRestoreCustomer = async (customerId: string) => {
    try {
      const res = await fetch(`${API_BASE}/customers/${customerId}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchCustomers();
        fetchInactiveCustomers();
        alert('Customer restored successfully');
      } else {
        alert('Restore failed');
      }
    } catch {
      alert('Error restoring customer');
    }
  };

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/loans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...loanForm,
          start_date: new Date().toISOString().split('T')[0]
        })
      });
      if (res.ok) {
        setShowAddLoan(false);
        fetchLoans();
        alert('Loan disbursed successfully');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to disburse loan');
      }
    } catch {
      alert('Error creating loan');
    }
  };

  const handleAddCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPayModal) return;
    try {
      const res = await fetch(`${API_BASE}/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          loan_id: showPayModal.id,
          ...paymentForm
        })
      });
      if (res.ok) {
        const balLeft = Math.max(0, showPayModal.balance - parseFloat(paymentForm.amount_collected || '0'));
        setShowPayModal(null);
        setPaymentForm({ amount_collected: '', collected_date: new Date().toISOString().split('T')[0], payment_method: 'cash', remarks: '', utr: '' });
        fetchLoans();
        fetchDashboard();
        fetchCollections();
        if (user?.role === 'customer') {
          speakTamil("பணம் செலுத்திய விபரம் சரிபார்ப்புக்கு அனுப்பப்பட்டது");
          alert('Payment submitted successfully for verification!');
        } else {
          speakTamil(`பணம் வெற்றிகரமாக பெறப்பட்டது. மீதமுள்ள தொகை ${balLeft} ரூபாய்`);
          alert('Repayment recorded successfully');
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to record payment');
      }
    } catch {
      alert('Error entering payment collection');
    }
  };

  const handleVerifyPayment = async (collectionId: string) => {
    try {
      const res = await fetch(`${API_BASE}/collections/${collectionId}/verify`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        alert('Payment verified and marked as received successfully');
        fetchLoans();
        fetchDashboard();
        fetchCollections();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to verify payment');
      }
    } catch {
      alert('Error verifying payment');
    }
  };

  const generateReport = async () => {
    try {
      const res = await fetch(`${API_BASE}/reports/report?type=${reportType}&start_date=${reportStartDate}&end_date=${reportEndDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setReportData(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerBackup = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings/backup`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('Backup created successfully');
        fetchBackups();
      } else {
        alert('Backup failed');
      }
    } catch {
      alert('Backup failed');
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUserForm)
      });
      if (res.ok) {
        alert('User registered successfully');
        setNewUserForm({ username: '', password: '', role: 'family', name: '' });
        fetchUsersList();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to register user');
      }
    } catch {
      alert('Error creating user');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupForm.password !== signupForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupForm)
      });
      if (res.ok) {
        alert('Account created successfully! You can now log in.');
        setIsSignup(false);
        setLoginUsername(signupForm.phone);
        setSignupForm({ name: '', phone: '', password: '', confirmPassword: '', village_area: '', aadhaar: '', address: '' });
      } else {
        const data = await res.json();
        alert(data.error || 'Signup failed');
      }
    } catch {
      alert('Error during registration');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user?.id,
          newPassword: changePasswordForm.newPassword
        })
      });
      if (res.ok) {
        alert('Password changed successfully');
        setShowChangePasswordModal(false);
        setChangePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to change password');
      }
    } catch {
      alert('Error changing password');
    }
  };

  const handleToggleDisableUser = async (userId: number) => {
    try {
      const res = await fetch(`${API_BASE}/auth/users/${userId}/toggle-disable`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchUsersList();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update user status');
      }
    } catch {
      alert('Error updating user status');
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToReset) return;
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: selectedUserToReset.id,
          newPassword: adminResetPassword
        })
      });
      if (res.ok) {
        alert(`Password for ${selectedUserToReset.name} reset successfully`);
        setSelectedUserToReset(null);
        setAdminResetPassword('');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reset password');
      }
    } catch {
      alert('Error resetting password');
    }
  };

  const downloadReceiptFile = (collectionId: string) => {
    window.open(`${API_BASE}/collections/${collectionId}/receipt?authorization=Bearer ${token}`, '_blank');
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950 px-4 text-white relative overflow-hidden">
        {/* Decorative subtle background glows */}
        <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-blue-500/10 blur-[120px]" />

        <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl relative z-10">
          
          {/* Header language toggle */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xs font-black uppercase tracking-wider text-amber-500">
              Sri Murugan Finance
            </h2>
            <button
              onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')}
              className="text-xs rounded border border-slate-700 bg-slate-800/50 px-2 py-1 text-slate-300 hover:bg-slate-700 transition"
            >
              🌐 {language === 'en' ? 'தமிழ்' : 'English'}
            </button>
          </div>

          {!isSignup ? (
            /* LOGIN SCREEN */
            <div>
              <div className="mb-6 text-center">
                <h1 className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
                  {language === 'en' ? 'Welcome Back' : 'நல்வரவு'}
                </h1>
                <p className="mt-1.5 text-xs text-slate-400">
                  {language === 'en' ? 'Secure Personal Lending Management Portal' : 'கடன் மேலாண்மை மற்றும் வசூல் போர்டல்'}
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {language === 'en' ? 'Mobile Number / Username' : 'கைபேசி எண் / பயனர் பெயர்'}
                  </label>
                  <input
                    type="text" required
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none transition-all"
                    placeholder={language === 'en' ? 'Enter username or mobile' : 'பயனர் பெயரை உள்ளிடவும்'}
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {language === 'en' ? 'Password' : 'கடவுச்சொல்'}
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type={showPassword ? 'text' : 'password'} required
                      className="w-full rounded-lg border border-slate-800 bg-slate-950/80 pl-3.5 pr-10 py-2.5 text-sm text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none transition-all"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3.5 text-xs font-bold text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? (language === 'en' ? 'Hide' : 'மறை') : (language === 'en' ? 'Show' : 'காட்டு')}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-1.5">
                  <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-800 bg-slate-950 text-amber-500 focus:ring-0"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>{language === 'en' ? 'Remember Me' : 'என்னை நினைவில் கொள்'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-amber-500 hover:underline"
                  >
                    {language === 'en' ? 'Forgot Password?' : 'கடவுச்சொல் மறந்துவிட்டதா?'}
                  </button>
                </div>

                {loginError && <p className="text-xs font-medium text-rose-500">{loginError}</p>}

                <div className="space-y-3 pt-3">
                  <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 py-3 font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500 transition-all shadow-md">
                    {language === 'en' ? 'Sign In' : 'உள்நுழையவும்'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSignup(true)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/30 py-3 font-semibold text-slate-300 hover:bg-slate-800 transition-all text-xs"
                  >
                    {language === 'en' ? 'Create Customer Account' : 'வாடிக்கையாளர் கணக்கு உருவாக்க'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* SIGNUP SCREEN */
            <div>
              <div className="mb-5 text-center">
                <h1 className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent">
                  {language === 'en' ? 'Customer Signup' : 'வாடிக்கையாளர் பதிவு'}
                </h1>
                <p className="mt-1 text-xs text-slate-400">
                  {language === 'en' ? 'Register yourself to track repayments and pay via UPI' : 'தவணை விவரங்களை அறிய உங்கள் கணக்கை பதிவு செய்யவும்'}
                </p>
              </div>

              <form onSubmit={handleSignup} className="space-y-3.5 max-h-[450px] overflow-y-auto pr-1">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name *</label>
                  <input
                    type="text" required
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white"
                    placeholder="Enter full name"
                    value={signupForm.name}
                    onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Mobile Number *</label>
                  <input
                    type="text" required
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white"
                    placeholder="10-digit mobile number"
                    value={signupForm.phone}
                    onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Village / Area *</label>
                  <input
                    type="text" required
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white"
                    placeholder="Village or Area"
                    value={signupForm.village_area}
                    onChange={(e) => setSignupForm({ ...signupForm, village_area: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Password *</label>
                  <input
                    type="password" required
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white"
                    placeholder="Password"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirm Password *</label>
                  <input
                    type="password" required
                    className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white"
                    placeholder="Confirm password"
                    value={signupForm.confirmPassword}
                    onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                  />
                </div>

                <div className="border-t border-slate-800 pt-3 space-y-3.5">
                  <h4 className="text-[10px] font-bold uppercase text-amber-500/80">Optional Information</h4>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400">Aadhaar Number</label>
                    <input
                      type="text"
                      className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white"
                      placeholder="Optional Aadhaar card number"
                      value={signupForm.aadhaar}
                      onChange={(e) => setSignupForm({ ...signupForm, aadhaar: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400">Address</label>
                    <textarea
                      className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3.5 py-2 text-xs text-white"
                      placeholder="Optional address"
                      value={signupForm.address}
                      onChange={(e) => setSignupForm({ ...signupForm, address: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-3">
                  <button type="submit" className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 py-3 font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500 transition-all shadow-md">
                    Submit Registration
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSignup(false)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/30 py-3 font-semibold text-slate-300 hover:bg-slate-800 transition-all text-xs"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Forgot Password modal */}
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-xs">
              <h3 className="font-extrabold text-amber-500 text-sm mb-3">Forgot Password / கடவுச்சொல் மீட்டமைக்க</h3>
              <p className="text-slate-300 leading-relaxed">
                For security reasons, customer and staff passwords can only be reset by the Sri Murugan Finance Administrators.
              </p>
              <p className="text-slate-400 mt-2 font-bold">
                Please contact support or call: +91 9876543210
              </p>
              <button
                onClick={() => setShowForgotModal(false)}
                className="mt-5 w-full bg-amber-500 text-slate-950 font-bold py-2 rounded hover:bg-amber-400 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <SpeedInsights />
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="hidden w-64 border-r border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-900/60 md:flex md:flex-col md:justify-between backdrop-blur-md">
        <div>
          <div className="p-6">
            <h1 className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 bg-clip-text text-xl font-black text-transparent">{t.appName}</h1>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Lending Solutions</span>
          </div>
          <nav className="space-y-1 px-3">
            {[
              { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard, roles: ['super_admin', 'admin', 'staff', 'family'] },
              { id: 'customer_dashboard', label: 'My Dashboard', icon: LayoutDashboard, roles: ['customer'] },
              { id: 'customers', label: t.customers, icon: Users, roles: ['super_admin', 'admin', 'staff', 'family'] },
              { id: 'loans', label: t.loans, icon: Banknote, roles: ['super_admin', 'admin', 'staff', 'family'] },
              { id: 'collections', label: t.collections, icon: HandCoins, roles: ['super_admin', 'admin', 'staff', 'family'] },
              { id: 'defaulters', label: t.defaulterList, icon: AlertTriangle, roles: ['super_admin', 'admin', 'staff', 'family'] },
              { id: 'reports', label: t.reports, icon: FileText, roles: ['super_admin', 'admin', 'family'] },
              { id: 'profile', label: 'My Profile', icon: Users, roles: ['customer'] },
              { id: 'settings', label: t.settings, icon: Settings, roles: ['super_admin', 'admin'] }
            ].filter(item => item.roles.includes(user?.role || '')).map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { setSelectedCustomerId(null); setCurrentView(item.id as any); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                    currentView === item.id ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-4">
            <button onClick={() => setLanguage(language === 'en' ? 'ta' : 'en')} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition hover:bg-slate-100 dark:border-slate-700">
              <Globe className="h-4 w-4" /> {language === 'en' ? 'தமிழ்' : 'English'}
            </button>
            <button onClick={() => {
              const nextVoice = !voiceEnabled;
              setVoiceEnabled(nextVoice);
              if (nextVoice) {
                // Speak confirmation
                const u = new SpeechSynthesisUtterance("ஒலி உதவி ஆன் செய்யப்பட்டுள்ளது");
                u.lang = 'ta-IN';
                window.speechSynthesis.speak(u);
              }
            }} className={`rounded-lg border p-2 hover:bg-slate-100 dark:border-slate-700 ${voiceEnabled ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-slate-400 border-slate-300'}`}>
              {voiceEnabled ? '🔊' : '🔇'}
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className="rounded-lg border p-2 hover:bg-slate-100 dark:border-slate-700">
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <div className="truncate">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-[10px] uppercase font-semibold text-slate-500">{user?.role}</p>
            </div>
            <button onClick={() => setToken(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-100 hover:text-rose-600">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900/60">
          <h2 className="text-lg font-bold capitalize text-slate-800 dark:text-white">{currentView}</h2>
          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">₹ INR</span>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {currentView === 'customer_dashboard' && (
            <div className="space-y-6">
              {/* Welcome Card */}
              <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-amber-600/5 p-6 shadow-sm">
                <h3 className="text-xl font-black text-amber-700 dark:text-amber-400">
                  வணக்கம் / Welcome, {user?.name}!
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Manage your personal loans, view outstanding balances, and securely pay via UPI / QR Code.
                </p>
              </div>

              {/* Loans List for Customer */}
              {loans.length === 0 ? (
                <div className="rounded-xl border bg-white p-6 text-center text-slate-400 dark:bg-slate-900 dark:border-slate-800">
                  No active loan accounts found.
                </div>
              ) : (
                loans.map(loan => {
                  const loanCollections = collections.filter(c => c.loan_id === loan.id);
                  const verifiedCollections = loanCollections.filter(c => c.status === 'received');
                  const lastPayment = verifiedCollections[0] 
                    ? `₹${verifiedCollections[0].amount_collected} on ${verifiedCollections[0].collected_date}` 
                    : 'No verified payments yet';
                  
                  return (
                    <div key={loan.id} className="rounded-2xl border bg-white p-6 shadow-sm space-y-6 dark:bg-slate-900 dark:border-slate-800">
                      <div className="flex justify-between items-center border-b pb-3 dark:border-slate-800">
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">Loan ID: {loan.id}</h4>
                          <p className="text-[10px] text-slate-400">Repayment Frequency: {loan.frequency}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${loan.status === 'active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-400'}`}>
                          {loan.status}
                        </span>
                      </div>

                      {/* Loan Summary Grid */}
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5 text-xs">
                        <div className="p-3 bg-slate-50 rounded-lg dark:bg-slate-800/40">
                          <span className="text-slate-400 font-bold block mb-1">Loan Amount</span>
                          <span className="font-black text-sm">₹{loan.amount}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg dark:bg-slate-800/40">
                          <span className="text-slate-400 font-bold block mb-1">Total Payable</span>
                          <span className="font-black text-sm">₹{loan.total_payable}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg dark:bg-slate-800/40">
                          <span className="text-slate-400 font-bold block mb-1">Amount Paid</span>
                          <span className="font-black text-sm text-emerald-600">₹{loan.total_collected}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg dark:bg-slate-800/40">
                          <span className="text-slate-400 font-bold block mb-1">Remaining Balance</span>
                          <span className="font-black text-sm text-rose-500">₹{loan.balance}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg dark:bg-slate-800/40 col-span-2 sm:col-span-1">
                          <span className="text-slate-400 font-bold block mb-1">Installment Amount</span>
                          <span className="font-black text-sm text-amber-500">₹{loan.installment_amount}</span>
                        </div>
                      </div>

                      {/* Payment Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold pt-2">
                        <div className="flex justify-between border-b pb-2 sm:border-0 sm:pb-0">
                          <span className="text-slate-400">Last Verified Payment:</span>
                          <span>{lastPayment}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2 sm:border-0 sm:pb-0">
                          <span className="text-slate-400">Next Installment Due:</span>
                          <span className="text-amber-500">{loan.due_date}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Installments Paid:</span>
                          <span>{verifiedCollections.length} / {loan.duration}</span>
                        </div>
                      </div>

                      {/* Payment Actions & QR Codes */}
                      {loan.status === 'active' && (
                        <div className="flex flex-col sm:flex-row gap-3 pt-3">
                          <button
                            onClick={() => {
                              setShowPayModal(loan);
                              setPaymentForm(p => ({ ...p, payment_method: 'upi', amount_collected: String(loan.installment_amount) }));
                            }}
                            className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-center shadow flex items-center justify-center gap-2 text-xs transition"
                          >
                            📲 Pay Now (UPI / QR Code)
                          </button>
                        </div>
                      )}

                      {/* Repayments History log for this specific loan */}
                      <div className="space-y-3 pt-4 border-t dark:border-slate-800">
                        <h5 className="font-bold text-xs uppercase text-slate-400">Repayments History</h5>
                        <div className="overflow-x-auto rounded-xl border dark:border-slate-800 bg-white dark:bg-slate-900">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 uppercase font-bold">
                              <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Amount Paid</th>
                                <th className="p-3">Payment Method</th>
                                <th className="p-3">Receipt Number</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y dark:divide-slate-800">
                              {loanCollections.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="p-4 text-center text-slate-400">No payment history found</td>
                                </tr>
                              ) : (
                                loanCollections.map(col => {
                                  const isPending = col.status === 'pending';
                                  return (
                                    <tr key={col.id} className={isPending ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''}>
                                      <td className="p-3">{col.collected_date}</td>
                                      <td className="p-3 font-bold text-emerald-600">₹{col.amount_collected}</td>
                                      <td className="p-3 uppercase text-[10px] font-bold">{col.payment_method}</td>
                                      <td className="p-3 font-bold text-slate-500">{col.id}</td>
                                      <td className="p-3">
                                        {isPending ? (
                                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">Pending</span>
                                        ) : (
                                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Received</span>
                                        )}
                                      </td>
                                      <td className="p-3">
                                        {!isPending && (
                                          <button
                                            onClick={() => downloadReceiptFile(col.id)}
                                            className="rounded border px-2 py-0.5 text-[10px] font-bold text-amber-500 border-amber-500 hover:bg-amber-500/10"
                                          >
                                            Download Receipt
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {currentView === 'profile' && (
            <div className="space-y-6 text-xs max-w-lg">
              <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900 dark:border-slate-800">
                <h3 className="font-extrabold text-sm uppercase text-slate-400 border-b pb-2 dark:border-slate-800">My Profile Details</h3>
                <div className="space-y-2 font-semibold">
                  <div><span className="text-slate-400 block mb-0.5">Name</span> <span className="text-sm font-bold">{user?.name}</span></div>
                  <div><span className="text-slate-400 block mb-0.5">Mobile Number / Username</span> <span className="text-sm font-bold">{user?.username}</span></div>
                  <div><span className="text-slate-400 block mb-0.5">Account Role</span> <span className="capitalize font-bold text-amber-500">{user?.role}</span></div>
                </div>
              </div>

              {/* Password Change Form */}
              <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900 dark:border-slate-800">
                <h3 className="font-extrabold text-sm uppercase text-slate-400 border-b pb-2 dark:border-slate-800">Change Password (கடவுச்சொல் மாற்று)</h3>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400">New Password</label>
                    <input
                      type="password" required
                      className="mt-1 w-full border p-2.5 rounded-lg dark:bg-slate-950 dark:border-slate-800"
                      value={changePasswordForm.newPassword}
                      onChange={e => setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value })}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400">Confirm New Password</label>
                    <input
                      type="password" required
                      className="mt-1 w-full border p-2.5 rounded-lg dark:bg-slate-950 dark:border-slate-800"
                      value={changePasswordForm.confirmPassword}
                      onChange={e => setChangePasswordForm({ ...changePasswordForm, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                    />
                  </div>
                  <button type="submit" className="bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs hover:bg-amber-400 transition shadow">
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          )}

          {currentView === 'dashboard' && dashboardData && (
            <div className="space-y-6">
              
              {/* Quick Actions Dashboard Panel */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Quick Actions (விரைவான செயல்பாடுகள்)</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <button onClick={() => setShowAddCustomer(true)} className="flex flex-col items-center justify-center p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition text-center gap-2">
                    <span className="text-2xl">👤</span>
                    <span className="font-bold text-xs text-amber-600 dark:text-amber-400">Add Customer<br/><span className="text-[10px] text-slate-400 font-normal">வாடிக்கையாளர் சேர்க்க</span></span>
                  </button>
                  <button onClick={() => setShowAddLoan(true)} className="flex flex-col items-center justify-center p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition text-center gap-2">
                    <span className="text-2xl">💵</span>
                    <span className="font-bold text-xs text-amber-600 dark:text-amber-400">New Loan<br/><span className="text-[10px] text-slate-400 font-normal">புதிய கடன் வழங்க</span></span>
                  </button>
                  <button onClick={() => setCurrentView('collections')} className="flex flex-col items-center justify-center p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition text-center gap-2">
                    <span className="text-2xl">📥</span>
                    <span className="font-bold text-xs text-amber-600 dark:text-amber-400">Record Payment<br/><span className="text-[10px] text-slate-400 font-normal">வசூல் பதிவு செய்ய</span></span>
                  </button>
                  <button onClick={() => setCurrentView('defaulters')} className="flex flex-col items-center justify-center p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition text-center gap-2">
                    <span className="text-2xl">⚠️</span>
                    <span className="font-bold text-xs text-rose-600 dark:text-rose-400">View Due / Overdue<br/><span className="text-[10px] text-slate-400 font-normal">நிலுவைத் தொகை பார்க்க</span></span>
                  </button>
                  <button onClick={() => setCurrentView('reports')} className="flex flex-col items-center justify-center p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition text-center gap-2">
                    <span className="text-2xl">📋</span>
                    <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">Download Reports<br/><span className="text-[10px] text-slate-400 font-normal">அறிக்கைகள் பதிவிறக்க</span></span>
                  </button>
                </div>
              </div>

              {/* Large Premium Dashboard Card Widgets */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: "Today's Collections", value: `₹${(dashboardData.summary.today_collections || 0).toLocaleString('en-IN')}`, color: 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400', desc: "இன்றைய வசூல் 🟢" },
                  { label: "Total Outstanding", value: `₹${(dashboardData.summary.total_outstanding || 0).toLocaleString('en-IN')}`, color: 'border-amber-500 bg-amber-500/5 text-amber-600 dark:text-amber-400', desc: "அசல் + வட்டி தவணை நிலுவை 🟠" },
                  { label: "Overdue Customers", value: `${dashboardData.summary.overdue_accounts_count || 0} Accounts`, color: 'border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400', desc: "தவறிய தவணைகள் 🔴" },
                  { label: "Total Customers", value: `${customers.length} Active`, color: 'border-slate-500 bg-slate-500/5 text-slate-700 dark:text-slate-300', desc: "மொத்த வாடிக்கையாளர்கள்" },
                  { label: "Active Loans", value: `${loans.filter(l => l.status === 'active').length} Active`, color: 'border-blue-500 bg-blue-500/5 text-blue-600 dark:text-blue-400', desc: "செயலில் உள்ள கடன்கள்" },
                  { label: "Today's Pending Target", value: `₹${(dashboardData.summary.pending_collections || 0).toLocaleString('en-IN')}`, color: 'border-orange-500 bg-orange-500/5 text-orange-600 dark:text-orange-400', desc: "இன்றைய மீதமுள்ள இலக்கு" }
                ].map((stat, i) => (
                  <div key={i} className={`rounded-2xl border-2 p-6 shadow-sm flex flex-col justify-between h-36 ${stat.color}`}>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider opacity-80">{stat.label}</p>
                      <p className="text-3xl font-black mt-2 tracking-tight">{stat.value}</p>
                    </div>
                    <p className="text-[11px] font-semibold opacity-90">{stat.desc}</p>
                  </div>
                ))}
              </div>

              {/* Recent collections log with PDF Download option */}
              <div className="rounded-xl border bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
                <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase text-slate-500">Recent Payments Log</h3>
                  <Activity className="h-4 w-4 text-amber-500" />
                </div>
                <div className="divide-y dark:divide-slate-800 text-xs">
                  {dashboardData.recent_activities.length === 0 ? (
                    <p className="p-4 text-slate-400 text-center">No recent collections</p>
                  ) : (
                    dashboardData.recent_activities.map((act: any) => (
                      <div key={act.id} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800">
                        <div>
                          <p className="font-bold">{act.customer_name}</p>
                          <p className="text-slate-400">{act.collected_date} | Receipt: {act.id}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-extrabold text-emerald-600">+₹{act.amount_collected}</p>
                          {act.status === 'pending' ? (
                            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">Pending</span>
                          ) : (
                            <button onClick={() => downloadReceiptFile(act.id)} className="rounded border px-2 py-0.5 text-[10px] font-bold text-amber-500 border-amber-500 hover:bg-amber-500/10">Receipt PDF</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Defaulters List */}
              <div className="rounded-xl border bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900">
                <div className="p-4 border-b dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase text-slate-500">Top Defaulters</h3>
                </div>
                <div className="divide-y dark:divide-slate-800 text-xs">
                  {dashboardData.defaulters.length === 0 ? (
                    <p className="p-4 text-slate-400 text-center">No defaulters listed</p>
                  ) : (
                    dashboardData.defaulters.map((def: any, i: number) => (
                      <div key={i} className="p-3 flex justify-between items-center">
                        <div>
                          <p className="font-bold">{def.customer_name} ({def.loan_id})</p>
                          <p className="text-slate-400">{def.days_overdue} days overdue</p>
                        </div>
                        <p className="font-bold text-rose-500">₹{def.amount_overdue.toLocaleString('en-IN')}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {currentView === 'customers' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text" className="w-full rounded-lg border pl-9 pr-4 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                    placeholder={t.searchCustomer} value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={fetchCustomers} className="rounded-lg bg-slate-100 px-4 py-2 text-xs font-bold dark:bg-slate-800">Search</button>
                  <button onClick={() => setShowAddCustomer(true)} className="flex items-center gap-1 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950">{t.addCustomer}</button>
                </div>
              </div>

              {selectedCustomerId && customerDetail ? (
                <div className="rounded-xl border bg-white p-5 space-y-6 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex justify-between items-center pb-2 border-b dark:border-slate-800">
                    <h3 className="font-bold text-lg">{customerDetail.customer.name} ({customerDetail.customer.id})</h3>
                    <div className="flex items-center gap-2">
                      {['super_admin', 'admin', 'family'].includes(user?.role || '') && (
                        <button
                          onClick={() => {
                            const activeLoansCount = customerDetail.loans.filter((l: any) => l.status === 'active').length;
                            setCustomerToDelete({ ...customerDetail.customer, activeLoansCount });
                          }}
                          className="flex items-center gap-1 bg-rose-600 text-white font-bold py-1 px-3 rounded text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Deactivate Customer
                        </button>
                      )}
                      <button onClick={() => setSelectedCustomerId(null)} className="p-1 text-slate-400"><X className="h-5 w-5" /></button>
                    </div>
                  </div>

                  {/* Customer Information summary card */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-lg">
                      <h4 className="font-bold uppercase text-[10px] text-slate-400 mb-2">Customer Information</h4>
                      <p><strong>Mobile:</strong> {customerDetail.customer.phone}</p>
                      <p><strong>Aadhaar:</strong> {customerDetail.customer.aadhaar}</p>
                      <p><strong>Area:</strong> {customerDetail.customer.village_area}</p>
                      <p><strong>Address:</strong> {customerDetail.customer.address}</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-lg">
                      <h4 className="font-bold uppercase text-[10px] text-slate-400 mb-2">Loan Summary</h4>
                      <p><strong>Total Loans:</strong> {customerDetail.loans.length}</p>
                      <p><strong>Active Loans:</strong> {customerDetail.loans.filter((l: any) => l.status === 'active').length}</p>
                      <p><strong>Closed Loans:</strong> {customerDetail.loans.filter((l: any) => l.status === 'closed').length}</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-lg">
                      <h4 className="font-bold uppercase text-[10px] text-slate-400 mb-2">Financial Summary</h4>
                      {(() => {
                        const totalBorrowed = customerDetail.loans.reduce((acc: number, curr: any) => acc + curr.amount, 0);
                        const totalCollected = customerDetail.collections.reduce((acc: number, curr: any) => acc + curr.amount_collected, 0);
                        
                        let totalPayable = 0;
                        customerDetail.loans.forEach((loan: any) => {
                          let payable = loan.amount;
                          if (loan.interest_type === 'flat') {
                            payable = loan.amount + (loan.amount * (loan.interest_rate / 100));
                          } else {
                            payable = loan.amount + (loan.amount * (loan.interest_rate / 100) * loan.duration);
                          }
                          totalPayable += payable;
                        });

                        const outstandingBalance = Math.max(0, totalPayable - totalCollected);
                        return (
                          <>
                            <p><strong>Total Borrowed:</strong> ₹{totalBorrowed.toLocaleString()}</p>
                            <p><strong>Total Collected:</strong> ₹{totalCollected.toLocaleString()}</p>
                            <p><strong>Outstanding Balance:</strong> ₹{outstandingBalance.toLocaleString()}</p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {customers.map(cust => (
                    <div key={cust.id} className="rounded-xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between h-32">
                      <div>
                        <h4 className="font-bold text-sm">{cust.name}</h4>
                        <p className="text-[10px] text-slate-400">{cust.id} | {cust.village_area}</p>
                        <p className="text-xs mt-2">{cust.phone}</p>
                      </div>
                      <button onClick={() => setSelectedCustomerId(cust.id)} className="text-xs text-amber-500 font-bold self-end hover:underline">View Profile</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentView === 'loans' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-black text-sm uppercase text-slate-500">{t.loans}</h3>
                {user?.role !== 'customer' && (
                  <button onClick={() => setShowAddLoan(true)} className="rounded bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950">Disburse Loan</button>
                )}
              </div>
              <div className="overflow-x-auto rounded-xl border dark:border-slate-800 dark:bg-slate-900 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 uppercase font-bold">
                    <tr>
                      <th className="p-3">Loan ID</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Interest</th>
                      <th className="p-3">Outstanding</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {loans.filter(l => user?.role !== 'customer' || l.customer_name === user.name || l.customer_phone === user.username).map(loan => (
                      <tr key={loan.id}>
                        <td className="p-3 font-bold">{loan.id}</td>
                        <td className="p-3">{loan.customer_name}</td>
                        <td className="p-3">₹{loan.amount}</td>
                        <td className="p-3">{loan.interest_rate}% ({loan.interest_type})</td>
                        <td className="p-3 text-amber-500 font-bold">₹{loan.balance}</td>
                        <td className="p-3 capitalize">{loan.status}</td>
                        <td className="p-3">
                          {loan.status === 'active' && (
                            user?.role === 'customer' ? (
                              <button onClick={() => {
                                setShowPayModal(loan);
                                setPaymentForm(p => ({ ...p, payment_method: 'upi', amount_collected: String(loan.installment_amount) }));
                              }} className="rounded bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-1.5 text-[10px] text-white font-bold shadow-sm hover:from-blue-600 hover:to-indigo-700">
                                Pay via UPI / QR
                              </button>
                            ) : (
                              <button onClick={() => {
                                setShowPayModal(loan);
                              }} className="rounded bg-emerald-600 px-2.5 py-1 text-[10px] text-white font-bold">
                                Record Pay
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentView === 'collections' && (
            <div className="space-y-6">
              {user?.role !== 'customer' && (
                <div className="overflow-x-auto rounded-xl border dark:border-slate-800 dark:bg-slate-900 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 uppercase font-bold">
                      <tr>
                        <th className="p-3">Reference</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Installment</th>
                        <th className="p-3">Outstanding</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800">
                      {loans.filter(l => l.status === 'active').map(loan => (
                        <tr key={loan.id}>
                          <td className="p-3 font-bold">{loan.id}</td>
                          <td className="p-3">{loan.customer_name}</td>
                          <td className="p-3">₹{loan.installment_amount} ({loan.frequency})</td>
                          <td className="p-3 text-amber-500 font-bold">₹{loan.balance}</td>
                          <td className="p-3">
                            <button onClick={() => { setShowPayModal(loan); setPaymentForm(p => ({ ...p, amount_collected: String(loan.installment_amount) })); }} className="rounded bg-amber-500 px-2 py-1 text-[11px] font-bold text-slate-950">Collect</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Collections History Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Repayments Log & History</h4>
                <div className="overflow-x-auto rounded-xl border dark:border-slate-800 dark:bg-slate-900 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 uppercase font-bold">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Amount Collected</th>
                        {user?.role !== 'customer' && <th className="p-3">Collector</th>}
                        <th className="p-3">Method</th>
                        <th className="p-3">UTR / Txn ID</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Balance After Payment</th>
                        <th className="p-3">Receipt Number</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800">
                      {collections.filter(c => user?.role !== 'customer' || c.customer_name === user.name || c.customer_phone === user.username).map(col => {
                        const isPending = col.status === 'pending';
                        return (
                          <tr key={col.id} className={isPending ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''}>
                            <td className="p-3">{col.collected_date}</td>
                            <td className="p-3 font-semibold">{col.customer_name}</td>
                            <td className="p-3 font-bold text-emerald-600">₹{col.amount_collected}</td>
                            {user?.role !== 'customer' && <td className="p-3">{col.collector_name}</td>}
                            <td className="p-3 uppercase text-[10px] font-bold">{col.payment_method}</td>
                            <td className="p-3 font-mono text-[10px] text-slate-500 dark:text-slate-400">{col.utr || '-'}</td>
                            <td className="p-3">
                              {isPending ? (
                                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                  Pending Verification
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                  Received
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-bold">₹{col.balance_after || 0}</td>
                            <td className="p-3 font-bold text-slate-500">{col.id}</td>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {!isPending ? (
                                  <button onClick={() => downloadReceiptFile(col.id)} className="rounded border px-2 py-0.5 text-[10px] font-bold text-amber-500 border-amber-500 hover:bg-amber-500/10">Download</button>
                                ) : (
                                  ['super_admin', 'admin', 'family', 'staff'].includes(user?.role || '') && (
                                    <button onClick={() => handleVerifyPayment(col.id)} className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-500 transition shadow-sm">Mark Received</button>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {currentView === 'defaulters' && dashboardData && (
            <div className="space-y-6">
              <div className="overflow-x-auto rounded-xl border dark:border-slate-800 dark:bg-slate-900 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 uppercase font-bold">
                    <tr>
                      <th className="p-3">Loan ID</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Days Overdue</th>
                      <th className="p-3">Overdue Amt</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-800">
                    {dashboardData.defaulters.map((def: any, i: number) => (
                      <tr key={i}>
                        <td className="p-3 font-bold">{def.loan_id}</td>
                        <td className="p-3">{def.customer_name}</td>
                        <td className="p-3 text-rose-500 font-bold">{def.days_overdue} days</td>
                        <td className="p-3 font-bold">₹{def.amount_overdue}</td>
                        <td className="p-3">
                          <a href={`https://wa.me/?text=Reminder%20from%20Sri%20Murugan%20Finance.`} target="_blank" className="bg-emerald-500 text-slate-950 px-2 py-1 rounded font-bold">WhatsApp</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentView === 'reports' && (
            <div className="space-y-6">
              <div className="rounded-2xl border bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-5 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Generate Business Reports (நிதி அறிக்கைகள்)</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Report Type (அறிக்கை வகை)</label>
                    <select className="w-full rounded-lg border p-2.5 text-sm dark:bg-slate-900 dark:border-slate-800" value={reportType} onChange={(e: any) => setReportType(e.target.value)}>
                      <option value="collections">Daily / Period Collections (வசூல் விவரங்கள்)</option>
                      <option value="defaulters">Defaulters / Overdues (நிலுவை பட்டியல்)</option>
                      <option value="outstanding">All Outstanding Loans (நிலுவையில் உள்ள கடன்கள்)</option>
                      <option value="profit">Profit & Revenue Report (லாப அறிக்கை)</option>
                      <option value="history">System Audit & Customer History (தணிக்கை பதிவு)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Start Date (துவக்க தேதி)</label>
                    <input type="date" className="w-full rounded-lg border p-2.5 text-sm dark:bg-slate-900 dark:border-slate-800" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">End Date (முடிவு தேதி)</label>
                    <input type="date" className="w-full rounded-lg border p-2.5 text-sm dark:bg-slate-900 dark:border-slate-800" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <a
                    href={`${API_BASE}/reports/export/pdf?type=${reportType}&start_date=${reportStartDate}&end_date=${reportEndDate}&authorization=Bearer ${token}`}
                    target="_blank"
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-xl text-center shadow flex items-center justify-center gap-2 text-xs transition"
                  >
                    📄 Download PDF (பிடிஎஃப்)
                  </a>
                  <a
                    href={`${API_BASE}/reports/export/csv?type=${reportType}&start_date=${reportStartDate}&end_date=${reportEndDate}&authorization=Bearer ${token}`}
                    target="_blank"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl text-center shadow flex items-center justify-center gap-2 text-xs transition"
                  >
                    📊 Download Excel (எக்செல்)
                  </a>
                  <a
                    href={`${API_BASE}/reports/export/csv?type=${reportType}&start_date=${reportStartDate}&end_date=${reportEndDate}&authorization=Bearer ${token}`}
                    target="_blank"
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-center shadow flex items-center justify-center gap-2 text-xs transition"
                  >
                    📁 Download CSV (சிஎஸ்வி)
                  </a>
                </div>
              </div>
            </div>
          )}

          {currentView === 'settings' && ['super_admin', 'admin', 'family'].includes(user?.role || '') && (
            <div className="space-y-6 text-xs">
              
              {/* Soft deleted / Inactive customers recovery panel */}
              <div className="rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <h3 className="font-bold border-b pb-2 dark:border-slate-800 uppercase text-slate-500">Deactivated / Inactive Customers</h3>
                {inactiveCustomers.length === 0 ? (
                  <p className="text-slate-400 text-xs">No deactivated customers</p>
                ) : (
                  <div className="space-y-1">
                    {inactiveCustomers.map(c => (
                      <div key={c.id} className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800 rounded">
                        <div>
                          <p className="font-bold">{c.name} ({c.id})</p>
                          <p className="text-slate-400">Phone: {c.phone} | Aadhaar: {c.aadhaar}</p>
                        </div>
                        <button onClick={() => handleRestoreCustomer(c.id)} className="flex items-center gap-1 rounded bg-amber-500 text-slate-950 font-bold px-3 py-1 hover:bg-amber-400">
                          <RotateCcw className="h-3.5 w-3.5" /> Restore Customer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Admin UPI Configuration Settings Form */}
              <div className="rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <h3 className="font-bold border-b pb-2 dark:border-slate-800 uppercase text-slate-500 text-xs">UPI & QR Code Payment Configuration (யுபிஐ அமைப்புகள்)</h3>
                <form onSubmit={handleUpdateSettings} className="space-y-3 max-w-md">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">UPI ID (பெறுநர் யுபிஐ முகவரி)</label>
                    <input type="text" placeholder="e.g. merchant@okicici" className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800 text-xs" value={settings.upi_id || ''} onChange={e => setSettings({ ...settings, upi_id: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Account Holder Name (கணக்கு வைத்திருப்பவர் பெயர்)</label>
                    <input type="text" placeholder="e.g. Sri Murugan Finance" className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800 text-xs" value={settings.upi_account_name || ''} onChange={e => setSettings({ ...settings, upi_account_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Bank Name (வங்கியின் பெயர்)</label>
                    <input type="text" placeholder="e.g. ICICI Bank" className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800 text-xs" value={settings.upi_bank_name || ''} onChange={e => setSettings({ ...settings, upi_bank_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1">Merchant Business Name (வணிகப் பெயர்)</label>
                    <input type="text" placeholder="e.g. Sri Murugan Finance" className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800 text-xs" value={settings.upi_merchant_name || ''} onChange={e => setSettings({ ...settings, upi_merchant_name: e.target.value })} />
                  </div>
                  <button type="submit" className="bg-amber-500 font-bold px-4 py-2 rounded text-slate-950 text-xs shadow hover:bg-amber-400">Save UPI Settings</button>
                </form>
              </div>

              <div className="rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-4">
                <div className="flex justify-between items-center border-b pb-2 dark:border-slate-800">
                  <h3 className="font-bold uppercase text-slate-500">System Backups</h3>
                  <button onClick={triggerBackup} className="rounded bg-amber-500 px-3 py-1 font-bold text-slate-950">Backup Database</button>
                </div>
                <div className="space-y-1">
                  {backups.map((bak, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-800 rounded">
                      <p>{bak.filename}</p>
                      <button onClick={async () => {
                        if (confirm('Restore backup?')) {
                          await fetch(`${API_BASE}/settings/restore`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ filename: bak.filename })
                          });
                          alert('Restore completed');
                        }
                      }} className="text-amber-500 font-bold">Restore</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* User management & registration system user */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-4">
                  <h3 className="font-bold border-b pb-2 dark:border-slate-800 uppercase text-slate-500 text-xs">Register System User</h3>
                  <form onSubmit={handleRegisterUser} className="space-y-2.5">
                    <input type="text" placeholder="Name" required className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800" value={newUserForm.name} onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })} />
                    <input type="text" placeholder="Username / Mobile" required className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800" value={newUserForm.username} onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })} />
                    <input type="password" placeholder="Password" required className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800" value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} />
                    <select required className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800" value={newUserForm.role} onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value as any })}>
                      <option value="super_admin">Super Administrator</option>
                      <option value="admin">Administrator</option>
                      <option value="family">Family Member</option>
                      <option value="staff">Staff / Collector</option>
                      <option value="customer">Customer</option>
                    </select>
                    <button type="submit" className="w-full bg-amber-500 font-bold py-2 rounded text-slate-950 text-xs">Register User</button>
                  </form>
                </div>

                <div className="rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-4">
                  <h3 className="font-bold border-b pb-2 dark:border-slate-800 uppercase text-slate-500 text-xs">System User Accounts</h3>
                  <div className="overflow-x-auto rounded-lg border dark:border-slate-800 max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 uppercase font-bold sticky top-0">
                        <tr>
                          <th className="p-2">Name</th>
                          <th className="p-2">Role</th>
                          <th className="p-2">Status</th>
                          <th className="p-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-slate-800">
                        {userManagementList.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-2 font-bold truncate max-w-[80px]">{u.name}</td>
                            <td className="p-2 capitalize font-semibold">{u.role}</td>
                            <td className="p-2">
                              {u.is_disabled === 1 ? (
                                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-bold text-rose-600 dark:text-rose-400">Disabled</span>
                              ) : (
                                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">Active</span>
                              )}
                            </td>
                            <td className="p-2 text-right space-x-1 whitespace-nowrap">
                              {u.username !== user?.username && (
                                <button
                                  onClick={() => handleToggleDisableUser(u.id)}
                                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${u.is_disabled === 1 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
                                >
                                  {u.is_disabled === 1 ? 'Enable' : 'Disable'}
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedUserToReset(u)}
                                className="rounded bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 text-[9px]"
                              >
                                Reset
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-2">
                <h3 className="font-bold border-b pb-2 dark:border-slate-800 uppercase text-slate-500">System Audit Logs</h3>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {auditLogs.map(log => (
                    <p key={log.id} className="text-[10px] text-slate-500"><strong>[{log.action}]</strong> {log.details} - {log.username} ({new Date(log.created_at).toLocaleDateString()})</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODALS */}

      {/* Admin Customer Deletion Modal (Soft Delete) */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white rounded-xl p-6 shadow-2xl dark:bg-slate-900 text-xs">
            <div className="flex justify-between items-center pb-2 border-b mb-3 dark:border-slate-800">
              <h3 className="font-bold text-rose-500">Delete / Deactivate Customer</h3>
              <button onClick={() => setCustomerToDelete(null)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSoftDeleteCustomer} className="space-y-4">
              <div className="bg-rose-50 dark:bg-rose-950/20 p-3 rounded">
                <p><strong>Customer:</strong> {customerToDelete.name} ({customerToDelete.id})</p>
                <p><strong>Active Loans:</strong> {customerToDelete.activeLoansCount} loans active</p>
              </div>
              <div>
                <label className="font-bold text-slate-500">Deletion Reason</label>
                <input type="text" required className="mt-1 w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800" value={deleteConfirmForm.reason} onChange={e => setDeleteConfirmForm({ ...deleteConfirmForm, reason: e.target.value })} placeholder="e.g. Loan fully settled and closed file" />
              </div>
              <div>
                <label className="font-bold text-slate-500">Confirm Admin Password</label>
                <input type="password" required className="mt-1 w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800" value={deleteConfirmForm.adminPassword} onChange={e => setDeleteConfirmForm({ ...deleteConfirmForm, adminPassword: e.target.value })} placeholder="••••••••" />
              </div>
              <button type="submit" className="w-full bg-rose-600 py-2.5 rounded font-bold text-white hover:bg-rose-500">Confirm Deactivation</button>
            </form>
          </div>
        </div>
      )}

      {showAddCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-sm">
          <div className="h-full w-full max-w-md bg-white p-6 shadow-2xl overflow-y-auto dark:bg-slate-900 flex flex-col justify-between text-xs">
            <div>
              <div className="flex justify-between items-center pb-3 border-b mb-4 dark:border-slate-800">
                <h3 className="text-sm font-bold uppercase text-slate-500">Add Customer</h3>
                <button onClick={() => setShowAddCustomer(false)} className="text-slate-400"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Full Name (முழு பெயர்) *</label>
                  <input type="text" placeholder="Full Name" required className="w-full border p-2.5 rounded text-sm dark:bg-slate-900 dark:border-slate-800" value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Mobile Number (கைபேசி எண்) *</label>
                  <input type="text" placeholder="Mobile Number" required className="w-full border p-2.5 rounded text-sm dark:bg-slate-900 dark:border-slate-800" value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Village / Area (ஊர் / பகுதி) *</label>
                  <input type="text" placeholder="Village / Area" required className="w-full border p-2.5 rounded text-sm dark:bg-slate-900 dark:border-slate-800" value={customerForm.village_area} onChange={e => setCustomerForm({ ...customerForm, village_area: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Aadhaar Number (ஆதார் எண் - விருப்பம்)</label>
                  <input type="text" placeholder="Aadhaar Number (Optional)" className="w-full border p-2.5 rounded text-sm dark:bg-slate-900 dark:border-slate-800" value={customerForm.aadhaar} onChange={e => setCustomerForm({ ...customerForm, aadhaar: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">PAN Number (பான் எண் - விருப்பம்)</label>
                  <input type="text" placeholder="PAN Number (Optional)" className="w-full border p-2.5 rounded text-sm dark:bg-slate-900 dark:border-slate-800" value={customerForm.pan} onChange={e => setCustomerForm({ ...customerForm, pan: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Address (முகவரி - விருப்பம்)</label>
                  <textarea placeholder="Address (Optional)" className="w-full border p-2.5 rounded text-sm dark:bg-slate-900 dark:border-slate-800" value={customerForm.address} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} />
                </div>

                <div className="border-t pt-3 space-y-3 dark:border-slate-800">
                  <h4 className="font-bold text-slate-400 text-[10px] uppercase">Upload Documents (ஆவணங்கள்)</h4>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Customer Photo</label>
                    <input type="file" accept="image/*" className="w-full text-xs" onChange={e => {
                      if (e.target.files && e.target.files[0]) setCustomerForm({ ...customerForm, photo: e.target.files[0] });
                    }} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Aadhaar Card Front</label>
                    <input type="file" accept="image/*" className="w-full text-xs" onChange={e => {
                      if (e.target.files && e.target.files[0]) setCustomerForm({ ...customerForm, aadhaar_front: e.target.files[0] });
                    }} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Aadhaar Card Back</label>
                    <input type="file" accept="image/*" className="w-full text-xs" onChange={e => {
                      if (e.target.files && e.target.files[0]) setCustomerForm({ ...customerForm, aadhaar_back: e.target.files[0] });
                    }} />
                  </div>
                </div>

                <button type="submit" className="w-full bg-amber-500 py-3 rounded-lg font-bold text-slate-950 text-sm shadow hover:bg-amber-400">Save Customer (சேமிக்க)</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAddLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-sm">
          <div className="h-full w-full max-w-md bg-white p-6 shadow-2xl overflow-y-auto dark:bg-slate-900 flex flex-col justify-between text-xs">
            <div>
              <div className="flex justify-between items-center pb-3 border-b mb-4 dark:border-slate-800">
                <h3 className="text-sm font-bold uppercase text-slate-500">Disburse Loan</h3>
                <button onClick={() => setShowAddLoan(false)} className="text-slate-400"><X className="h-5 w-5" /></button>
              </div>
              <form onSubmit={handleCreateLoan} className="space-y-3">
                <select required className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800" value={loanForm.customer_id} onChange={e => setLoanForm({ ...loanForm, customer_id: e.target.value })}>
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="number" placeholder="Loan Amount" required className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800" value={loanForm.amount} onChange={e => setLoanForm({ ...loanForm, amount: e.target.value })} />
                <input type="number" placeholder="Interest Rate %" required className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800" value={loanForm.interest_rate} onChange={e => setLoanForm({ ...loanForm, interest_rate: e.target.value })} />
                <select className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800" value={loanForm.interest_type} onChange={(e: any) => setLoanForm({ ...loanForm, interest_type: e.target.value })}>
                  <option value="percentage">Percentage (Vaddi)</option>
                  <option value="flat">Flat interest amount</option>
                </select>
                <select className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800" value={loanForm.frequency} onChange={(e: any) => setLoanForm({ ...loanForm, frequency: e.target.value })}>
                  <option value="daily">Daily Collection</option>
                  <option value="weekly">Weekly Collection</option>
                  <option value="monthly">Monthly Collection</option>
                </select>
                <input type="number" placeholder="Duration (terms)" required className="w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800" value={loanForm.duration} onChange={e => setLoanForm({ ...loanForm, duration: e.target.value })} />
                <button type="submit" className="w-full bg-amber-500 py-2.5 rounded font-bold text-slate-950">Confirm & Disburse</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl dark:bg-slate-900 text-xs">
            <div className="flex justify-between items-center pb-3 border-b mb-4 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase">Collect Payment (பணம் பெறுதல்)</h3>
                <p className="text-[10px] text-slate-400">Loan ID: {showPayModal.id}</p>
              </div>
              <button onClick={() => setShowPayModal(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            
            {/* Extended Collection Entry Form showing outstanding variables */}
            <div className="mb-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-2 text-xs font-semibold">
              <div className="flex justify-between"><span className="text-slate-500">Customer Name:</span> <span className="font-bold">{showPayModal.customer_name}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Original Loan:</span> <span>₹{showPayModal.amount?.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Payable:</span> <span>₹{showPayModal.total_payable?.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Collected So Far:</span> <span className="text-emerald-600">₹{showPayModal.total_collected?.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Remaining Balance:</span> <span className="text-rose-600 font-bold">₹{showPayModal.balance?.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Installment Due:</span> <span className="text-amber-600">₹{showPayModal.installment_amount?.toLocaleString('en-IN')} / {showPayModal.frequency}</span></div>
            </div>

            <form onSubmit={handleAddCollection} className="space-y-4">
              <div>
                <label className="font-bold text-slate-500 dark:text-slate-400 block mb-1">Collection Date (தேதி)</label>
                <input type="date" required className="w-full border p-2.5 rounded-lg text-sm dark:bg-slate-900 dark:border-slate-800" value={paymentForm.collected_date} onChange={e => setPaymentForm({ ...paymentForm, collected_date: e.target.value })} />
              </div>
              
              <div>
                <label className="font-bold text-slate-500 dark:text-slate-400 block mb-1">Amount to Collect (பெற வேண்டிய தொகை) *</label>
                <input type="number" placeholder="Amount Collected" required className="w-full border p-2.5 rounded-lg text-sm dark:bg-slate-900 dark:border-slate-800" value={paymentForm.amount_collected} onChange={e => setPaymentForm({ ...paymentForm, amount_collected: e.target.value })} />
              </div>

              {/* Dynamic calculations on entry */}
              {paymentForm.amount_collected && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs space-y-1.5 text-amber-700 dark:text-amber-400 font-bold">
                  <div className="flex justify-between"><span>Previous Balance:</span> <span>₹{showPayModal.balance}</span></div>
                  <div className="flex justify-between"><span>Amount Received:</span> <span>₹{paymentForm.amount_collected}</span></div>
                  <div className="flex justify-between"><span>Remaining Balance:</span> <span>₹{Math.max(0, showPayModal.balance - parseFloat(paymentForm.amount_collected || '0'))}</span></div>
                  <div className="flex justify-between"><span>Loan Status Preview:</span> <span className="capitalize">{
                    Math.max(0, showPayModal.balance - parseFloat(paymentForm.amount_collected || '0')) === 0
                      ? 'Fully Paid 🟢'
                      : parseFloat(paymentForm.amount_collected || '0') > 0
                        ? 'Partially Paid 🟠'
                        : 'Active 🔴'
                  }</span></div>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-500 dark:text-slate-400 block mb-1">Payment Method (பணம் செலுத்தும் முறை)</label>
                <select className="w-full border p-2.5 rounded-lg text-sm dark:bg-slate-900 dark:border-slate-800" value={paymentForm.payment_method} onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}>
                  <option value="cash">Cash / ரொக்கம்</option>
                  <option value="upi">UPI Payment Link</option>
                  <option value="qr_code">Dynamic QR Code</option>
                  <option value="bank_transfer">Bank Transfer / வங்கி</option>
                </select>
              </div>

              {/* QR & UPI Links */}
              {(paymentForm.payment_method === 'upi' || paymentForm.payment_method === 'qr_code') && (
                <div className="border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col items-center gap-3 bg-slate-50 dark:bg-slate-900/40">
                  <p className="text-center font-bold text-slate-500">Scan QR Code or Tap UPI Link to Pay</p>
                  {(() => {
                    const collectAmount = paymentForm.amount_collected || String(showPayModal.installment_amount || '0');
                    const merchantUpi = settings.upi_id || 'srimuruganfinance@okicici';
                    const merchantName = settings.upi_merchant_name || 'Sri Murugan Finance';
                    const upiString = `upi://pay?pa=${merchantUpi}&pn=${encodeURIComponent(merchantName)}&am=${collectAmount}&tn=LoanRepay-${showPayModal.id}&cu=INR`;
                    
                    // Use static image if qr_code, otherwise use dynamic QR code
                    const qrUrl = paymentForm.payment_method === 'qr_code' ? scanQrCodeImg : `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiString)}`;
                    
                    return (
                      <>
                        <img src={qrUrl} alt="UPI Payment QR" className="border-2 border-white rounded shadow max-w-[180px] max-h-[180px]" />
                        <div className="text-center space-y-1">
                          <p className="font-extrabold text-slate-800 dark:text-white">Amount Payable: ₹{collectAmount}</p>
                          {paymentForm.payment_method === 'upi' ? (
                            <>
                              <p className="text-[10px] text-slate-400 select-all">UPI ID: {merchantUpi}</p>
                              {settings.upi_account_name && <p className="text-[9px] text-slate-500">Account: {settings.upi_account_name}</p>}
                            </>
                          ) : (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 p-2 rounded mt-2 text-center">
                              ⚠️ This is Sri Murugan Finance's official fixed QR code. Please scan and enter the amount <strong>₹{collectAmount}</strong> manually in your UPI app.
                            </p>
                          )}
                        </div>
                        {paymentForm.payment_method === 'upi' && (
                          <a href={upiString} className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-center py-2.5 rounded-lg font-bold shadow hover:shadow-lg transition">Open UPI App Link</a>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {paymentForm.payment_method !== 'cash' && (
                <div>
                  <label className="font-bold text-slate-500 dark:text-slate-400 block mb-1">Transaction UTR / ID (பரிவர்த்தனை எண்) *</label>
                  <input type="text" placeholder="Enter 12-digit UTR or Txn ID" required className="w-full border p-2.5 rounded-lg text-sm dark:bg-slate-900 dark:border-slate-800" value={paymentForm.utr || ''} onChange={e => setPaymentForm({ ...paymentForm, utr: e.target.value })} />
                </div>
              )}

              <button type="submit" className="w-full bg-amber-500 py-3 rounded-lg font-bold text-slate-950 text-sm shadow hover:bg-amber-400 transition">Record Payment (பதிவு செய்க)</button>
            </form>
          </div>
        </div>
      )}

      {/* Admin User Password Reset Modal */}
      {selectedUserToReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-white rounded-xl p-5 shadow-2xl dark:bg-slate-900 text-xs">
            <div className="flex justify-between items-center pb-2 border-b mb-3 dark:border-slate-800">
              <h3 className="font-bold text-amber-500">Reset User Password</h3>
              <button onClick={() => setSelectedUserToReset(null)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleAdminResetPassword} className="space-y-4">
              <div className="bg-amber-500/5 border border-amber-500/20 p-2.5 rounded">
                <p><strong>User:</strong> {selectedUserToReset.name} ({selectedUserToReset.username})</p>
                <p><strong>Role:</strong> {selectedUserToReset.role}</p>
              </div>
              <div>
                <label className="font-bold text-slate-500">New Password</label>
                <input
                  type="password" required
                  className="mt-1 w-full border p-2 rounded dark:bg-slate-900 dark:border-slate-800 text-xs"
                  value={adminResetPassword}
                  onChange={e => setAdminResetPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <button type="submit" className="w-full bg-amber-500 py-2.5 rounded font-bold text-slate-950 hover:bg-amber-400">
                Confirm Reset
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
