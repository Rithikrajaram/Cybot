import { Link } from 'react-router-dom';
import { Shield, LayoutDashboard, History, LogOut } from 'lucide-react';
import api from '../services/api';

const Navbar = ({ user, onLogout }) => {
    const handleLogout = async () => {
        try {
            await api.get('/logout');
            onLogout();
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    return (
        <nav className="bg-background/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-primary/10 rounded-lg border border-primary/20">
                            <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-lg font-bold text-white tracking-wide">
                            CYBOT<span className="text-text-dim font-normal ml-1">SECURE</span>
                        </span>
                    </div>

                    {user && (
                        <div className="flex items-center gap-1">
                            <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-dim hover:text-white hover:bg-white/5 rounded-lg transition-all">
                                <LayoutDashboard className="w-4 h-4" />
                                Dashboard
                            </Link>
                            <Link to="/logs" className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-text-dim hover:text-white hover:bg-white/5 rounded-lg transition-all">
                                <History className="w-4 h-4" />
                                Logs
                            </Link>
                            <div className="h-6 w-px bg-white/10 mx-2"></div>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
