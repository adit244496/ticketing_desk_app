// frontend/src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, resetFirstPassword } from '../api';
import { Mail, Lock, Eye, EyeOff, LogIn, Building2, KeyRound } from 'lucide-react';

const Login = ({ setUser }) => {
    const navigate = useNavigate();
    
    // Standard Login State
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    
    // First-Time Reset State
    const [isForceReset, setIsForceReset] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    
    // Transition State
    const [isTransitioning, setIsTransitioning] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const data = await loginUser({ login_id: loginId, password });
            
            if (data.force_reset) {
                setIsForceReset(true);
                setResetEmail(data.email);
            } else {
                localStorage.setItem('ticket_user', JSON.stringify(data.user));
                setUser(data.user);
                
                // Trigger sliding doors transition
                setIsTransitioning(true);
                
                setTimeout(() => {
                    // Normalize the role from the database to handle spelling and spacing inconsistencies
                    const rawRole = String(data.user.role || '').toLowerCase().replace(/\s+/g, '');
                    
                    if (['admin', 'superadmin', 'audit'].includes(rawRole)) navigate('/admin');
                    else if (rawRole === 'dept.head') navigate('/dept-head');
                    else if (rawRole === 'solver') navigate('/solver');
                    else navigate('/requestor'); // Catches 'requester', 'requestor', 'user', etc.
                }, 800);
            }
        } catch (err) {
            setError(err.response?.data?.error || "Login failed. Please try again.");
        }
    };

    const handleForceReset = async (e) => {
        e.preventDefault();
        setError('');
        
        if (newPassword !== confirmPassword) {
            return setError("Passwords do not match.");
        }
        if (newPassword.length < 8) {
            return setError("Password must be at least 8 characters.");
        }

        try {
            await resetFirstPassword({ email: resetEmail, new_password: newPassword });
            alert("Password reset successfully! Please log in with your new password.");
            setIsForceReset(false);
            setPassword('');
        } catch (err) {
            setError(err.response?.data?.error || "Reset failed.");
        }
    };

    return (
        <div style={styles.pageContainer}>
            <style>{`
                @keyframes floatCube1 {
                    0% { transform: translateY(0) rotateX(60deg) rotateZ(45deg); }
                    50% { transform: translateY(-40px) rotateX(60deg) rotateZ(45deg); }
                    100% { transform: translateY(0) rotateX(60deg) rotateZ(45deg); }
                }
                @keyframes floatCube2 {
                    0% { transform: translateY(0) rotateX(60deg) rotateZ(45deg); }
                    50% { transform: translateY(60px) rotateX(60deg) rotateZ(45deg); }
                    100% { transform: translateY(0) rotateX(60deg) rotateZ(45deg); }
                }
                @keyframes pulseGrid {
                    0% { opacity: 0.2; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.05); }
                    100% { opacity: 0.2; transform: scale(1); }
                }
                @keyframes slideInRight {
                    0% { opacity: 0; transform: translateX(50px); }
                    100% { opacity: 1; transform: translateX(0); }
                }
                @keyframes fadeInSlow {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                @keyframes slideOutLeft {
                    0% { transform: translateX(0); opacity: 1; }
                    100% { transform: translateX(-100%); opacity: 0; }
                }
                @keyframes slideOutRight {
                    0% { transform: translateX(0); opacity: 1; }
                    100% { transform: translateX(100%); opacity: 0; }
                }
                
                /* Responsive Split Screen */
                .split-container {
                    display: flex;
                    min-height: 125vh;
                    width: 100%;
                    overflow: hidden;
                    background-color: transparent;
                    position: relative;
                    z-index: 10;
                }
                .hero-panel {
                    flex: 1;
                    position: relative;
                    background: linear-gradient(135deg, #09090b 0%, #172554 50%, #0c0a15 100%);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    padding: 80px;
                    overflow: hidden;
                    animation: fadeInSlow 1.5s ease-out forwards;
                }
                .hero-panel.slide-out-left {
                    animation: slideOutLeft 0.8s cubic-bezier(0.7, 0, 0.3, 1) forwards !important;
                }
                .form-panel {
                    flex: 1;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background-color: #09090b;
                    padding: 40px;
                    border-left: 1px solid rgba(255,255,255,0.05);
                    animation: slideInRight 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                }
                .form-panel.slide-out-right {
                    animation: slideOutRight 0.8s cubic-bezier(0.7, 0, 0.3, 1) forwards !important;
                }
                
                @media (max-width: 900px) {
                    .split-container {
                        flex-direction: column;
                    }
                    .hero-panel {
                        display: none; /* Hide heavy graphics on mobile to focus on login */
                    }
                    .form-panel {
                        border-left: none;
                        padding: 20px;
                    }
                }

                .login-input:focus {
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2), inset 0 2px 4px rgba(0,0,0,0.2) !important;
                    background-color: rgba(15, 23, 42, 0.6) !important;
                }
                .login-input:hover {
                    border-color: rgba(255, 255, 255, 0.2);
                }
                .login-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(59, 130, 246, 0.6) !important;
                    background-color: #60a5fa !important;
                }
                .login-btn:active {
                    transform: translateY(1px);
                    box-shadow: 0 2px 10px rgba(59, 130, 246, 0.4) !important;
                }
                .icon-btn:hover {
                    transform: scale(1.1);
                    color: #e2e8f0 !important;
                }
                
                /* Isometric Cube CSS */
                .iso-cube {
                    position: absolute;
                    width: 120px;
                    height: 120px;
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.4);
                    box-shadow: inset 0 0 20px rgba(59, 130, 246, 0.2), 0 20px 40px rgba(0,0,0,0.5);
                    backdrop-filter: blur(8px);
                }
            `}</style>

            {/* MOCK DASHBOARD BACKGROUND FOR SEAMLESS TRANSITION */}
            {isTransitioning && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 0, backgroundColor: '#09090b', display: 'flex' }}>
                    <div style={{ width: '200px', backgroundColor: '#0f172a', borderRight: '1px solid rgba(255,255,255,0.05)' }}></div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ height: '52px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}></div>
                        <div style={{ flex: 1, padding: '24px' }}>
                            <div style={{ width: '200px', height: '24px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '24px' }}></div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} style={{ height: '80px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}></div>
                                ))}
                            </div>
                            <div style={{ height: '300px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}></div>
                        </div>
                    </div>
                </div>
            )}

            <div className="split-container">
                {/* LEFT HERO PANEL (Immersive Graphics) */}
                <div className={`hero-panel ${isTransitioning ? 'slide-out-left' : ''}`}>
                    {/* Background Grid */}
                    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)', backgroundSize: '40px 40px', transform: 'perspective(1000px) rotateX(60deg) translateY(-100px) translateZ(-200px)', transformOrigin: 'top center', animation: 'pulseGrid 8s ease-in-out infinite', zIndex: 0 }} />
                    
                    {/* Glowing Orbs */}
                    <div style={{ position: 'absolute', top: '20%', left: '10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(50px)', zIndex: 1 }} />
                    <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(60px)', zIndex: 1 }} />

                    {/* Animated Isometric Elements */}
                    <div className="iso-cube" style={{ top: '15%', right: '15%', animation: 'floatCube1 8s ease-in-out infinite', zIndex: 2 }} />
                    <div className="iso-cube" style={{ bottom: '25%', left: '20%', width: '80px', height: '80px', animation: 'floatCube2 12s ease-in-out infinite reverse', zIndex: 2 }} />
                    <div className="iso-cube" style={{ top: '50%', right: '25%', width: '160px', height: '160px', background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.3)', animation: 'floatCube1 10s ease-in-out infinite 1s', zIndex: 2 }} />

                    {/* Hero Content */}
                    <div style={{ position: 'relative', zIndex: 10, maxWidth: '600px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '12px 24px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '100px', marginBottom: '32px', backdropFilter: 'blur(12px)' }}>
                            <Building2 size={24} color="#60a5fa" />
                            <span style={{ color: '#bfdbfe', fontWeight: '700', fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Ambuja Neotia</span>
                        </div>
                        <h1 style={{ fontSize: '56px', fontWeight: '800', color: '#ffffff', lineHeight: '1.1', letterSpacing: '-0.04em', marginBottom: '24px', textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                            Build the <span style={{ color: '#3b82f6' }}>future</span> of enterprise.
                        </h1>
                        <p style={{ fontSize: '18px', color: '#94a3b8', lineHeight: '1.6', fontWeight: '500', maxWidth: '480px' }}>
                            The central hub for all internal operations, engineering support, and facility management ticketing.
                        </p>
                    </div>
                </div>

                {/* RIGHT FORM PANEL (Login Interface) */}
                <div className={`form-panel ${isTransitioning ? 'slide-out-right' : ''}`}>
                    <div style={styles.card}>
                        {/* FORM HEADER */}
                        <div style={styles.header}>
                            <h2 style={styles.title}>Welcome Back</h2>
                            <p style={styles.subtitle}>Sign in to access your dashboard</p>
                        </div>

                        {error && (
                            <div style={styles.errorBox}>
                                {error}
                            </div>
                        )}

                        {/* LOGIN FORM */}
                        {!isForceReset ? (
                            <form onSubmit={handleLogin} style={styles.form}>
                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Email Address or Phone</label>
                                    <div style={styles.inputWrapper}>
                                        <Mail size={18} color="#94a3b8" style={styles.leftIcon} />
                                        <input 
                                            type="text" 
                                            className="login-input"
                                            style={styles.input} 
                                            placeholder="Enter your email or phone"
                                            value={loginId} 
                                            onChange={(e) => setLoginId(e.target.value)} 
                                            required 
                                        />
                                    </div>
                                </div>

                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Password</label>
                                    <div style={styles.inputWrapper}>
                                        <Lock size={18} color="#94a3b8" style={styles.leftIcon} />
                                        <input 
                                            type={showPassword ? "text" : "password"} 
                                            className="login-input"
                                            style={styles.input} 
                                            placeholder="Enter your password"
                                            value={password} 
                                            onChange={(e) => setPassword(e.target.value)} 
                                            required 
                                        />
                                        <button 
                                            type="button" 
                                            className="icon-btn"
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={styles.rightIconButton}
                                        >
                                            {showPassword ? <EyeOff size={18} color="#94a3b8" /> : <Eye size={18} color="#94a3b8" />}
                                        </button>
                                    </div>
                                </div>

                                <button type="submit" className="login-btn" style={styles.submitButton}>
                                    <LogIn size={18} /> Sign In
                                </button>
                            </form>
                        ) : (
                            /* FORCE RESET FORM */
                            <form onSubmit={handleForceReset} style={styles.form}>
                                <div style={styles.warningBox}>
                                    <strong>First Login Detected.</strong><br/>
                                    Please set a secure password to continue.
                                </div>

                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>New Password (Min 8 chars)</label>
                                    <div style={styles.inputWrapper}>
                                        <KeyRound size={18} color="#94a3b8" style={styles.leftIcon} />
                                        <input 
                                            type={showNewPassword ? "text" : "password"} 
                                            className="login-input"
                                            style={styles.input} 
                                            placeholder="Create new password"
                                            value={newPassword} 
                                            onChange={(e) => setNewPassword(e.target.value)} 
                                            required 
                                        />
                                        <button 
                                            type="button" 
                                            className="icon-btn"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            style={styles.rightIconButton}
                                        >
                                            {showNewPassword ? <EyeOff size={18} color="#94a3b8" /> : <Eye size={18} color="#94a3b8" />}
                                        </button>
                                    </div>
                                </div>

                                <div style={styles.inputGroup}>
                                    <label style={styles.label}>Confirm Password</label>
                                    <div style={styles.inputWrapper}>
                                        <Lock size={18} color="#94a3b8" style={styles.leftIcon} />
                                        <input 
                                            type="password" 
                                            className="login-input"
                                            style={styles.input} 
                                            placeholder="Confirm new password"
                                            value={confirmPassword} 
                                            onChange={(e) => setConfirmPassword(e.target.value)} 
                                            required 
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="login-btn" style={styles.submitButton}>
                                    <KeyRound size={18} /> Update Password
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Bespoke UI Styles matching the Neo premium dynamic aesthetic
const styles = {
    pageContainer: {
        width: '100%',
        minHeight: '125vh',
        fontFamily: "'Inter', sans-serif",
    },
    card: {
        width: '100%',
        maxWidth: '400px',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start', // Left align for the new layout
        marginBottom: '40px'
    },
    title: {
        fontSize: '32px',
        fontWeight: '800',
        color: '#ffffff',
        margin: '0 0 8px 0',
        letterSpacing: '-0.03em',
    },
    subtitle: {
        fontSize: '15px',
        color: '#94a3b8',
        margin: 0,
        fontWeight: '500',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
    },
    inputGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    label: {
        fontSize: '12px',
        fontWeight: '700',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        paddingLeft: '4px'
    },
    inputWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center'
    },
    leftIcon: {
        position: 'absolute',
        left: '16px',
        pointerEvents: 'none'
    },
    rightIconButton: {
        position: 'absolute',
        right: '16px',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        color: '#94a3b8'
    },
    input: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.03)', // Subtle transparent fill
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '14px',
        padding: '16px 44px 16px 44px', 
        fontSize: '15px',
        fontWeight: '500',
        color: '#ffffff',
        outline: 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    submitButton: {
        backgroundColor: '#3b82f6', // Premium blue
        color: '#ffffff',
        border: 'none',
        borderRadius: '14px',
        padding: '16px 24px',
        fontSize: '15px',
        fontWeight: '700',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 4px 15px rgba(59, 130, 246, 0.2)',
        marginTop: '8px',
        letterSpacing: '0.02em'
    },
    errorBox: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        color: '#fca5a5',
        padding: '14px',
        borderRadius: '12px',
        fontSize: '13px',
        textAlign: 'center',
        marginBottom: '24px',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        fontWeight: '500'
    },
    warningBox: {
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        color: '#fcd34d',
        padding: '16px',
        borderRadius: '12px',
        fontSize: '13px',
        textAlign: 'center',
        marginBottom: '20px',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        lineHeight: '1.6',
        fontWeight: '500'
    }
};

export default Login;