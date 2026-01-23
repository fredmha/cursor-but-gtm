
import React, { useState } from 'react';
import { useStore, generateId } from '../store';
import { Icons } from '../constants';
import { Role } from '../types';

export const SettingsView: React.FC = () => {
  const { campaign, updateCampaign, users, addUser, removeUser, updateUser, currentUser } = useStore();
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'TEAM'>('GENERAL');
  
  // Team Management State
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('Member');

  const handleUpdateCampaignName = (name: string) => {
      updateCampaign({ name });
  };

  const handleAddUser = () => {
      if (newUserName.trim()) {
          addUser(newUserName.trim(), newUserRole);
          setNewUserName('');
          setIsAddingUser(false);
      }
  };

  return (
    <div className="h-full flex bg-white font-sans text-zinc-900">
        
        {/* Settings Sidebar */}
        <div className="w-64 border-r border-zinc-100 bg-zinc-50/50 p-6 flex flex-col shrink-0">
            <h2 className="text-sm font-bold text-zinc-900 mb-6 flex items-center gap-2">
                <Icons.Settings className="w-4 h-4 text-zinc-500" /> Settings
            </h2>
            <nav className="space-y-1">
                <button 
                    onClick={() => setActiveTab('GENERAL')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === 'GENERAL' ? 'bg-white shadow-sm text-zinc-900 ring-1 ring-zinc-200' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                >
                    General
                </button>
                <button 
                    onClick={() => setActiveTab('TEAM')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === 'TEAM' ? 'bg-white shadow-sm text-zinc-900 ring-1 ring-zinc-200' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
                >
                    Team Members
                </button>
            </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-12 bg-white">
            <div className="max-w-3xl">
                
                {activeTab === 'GENERAL' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-zinc-900 mb-1">General Settings</h3>
                            <p className="text-sm text-zinc-500">Manage basic campaign information.</p>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Campaign Name</label>
                                <input 
                                    className="w-full max-w-md bg-white border border-zinc-200 rounded-lg px-4 py-2 text-sm text-zinc-900 focus:outline-none focus:border-indigo-500 shadow-sm"
                                    value={campaign?.name || ''}
                                    onChange={(e) => handleUpdateCampaignName(e.target.value)}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Objective</label>
                                <textarea 
                                    className="w-full max-w-md bg-white border border-zinc-200 rounded-lg px-4 py-2 text-sm text-zinc-900 focus:outline-none focus:border-indigo-500 shadow-sm resize-none h-32"
                                    value={campaign?.objective || ''}
                                    onChange={(e) => updateCampaign({ objective: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'TEAM' && (
                    <div className="space-y-8 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900 mb-1">Team Members</h3>
                                <p className="text-sm text-zinc-500">Manage access and roles.</p>
                            </div>
                            <button 
                                onClick={() => setIsAddingUser(true)}
                                className="px-4 py-2 bg-zinc-900 text-white text-xs font-bold rounded-lg hover:bg-zinc-800 transition-colors shadow-sm flex items-center gap-2"
                            >
                                <Icons.Plus className="w-3.5 h-3.5" /> Add Member
                            </button>
                        </div>

                        {/* Add User Row */}
                        {isAddingUser && (
                            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 flex items-center gap-4 animate-in slide-in-from-top-2">
                                <input 
                                    autoFocus
                                    placeholder="Name (e.g. Alice Smith)"
                                    className="flex-1 bg-white border border-zinc-200 rounded px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:border-indigo-500"
                                    value={newUserName}
                                    onChange={e => setNewUserName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddUser()}
                                />
                                <select 
                                    className="bg-white border border-zinc-200 rounded px-3 py-1.5 text-sm text-zinc-900 focus:outline-none"
                                    value={newUserRole}
                                    onChange={e => setNewUserRole(e.target.value as Role)}
                                >
                                    <option value="Member">Member</option>
                                    <option value="Admin">Admin</option>
                                </select>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsAddingUser(false)} className="text-xs text-zinc-500 font-bold hover:text-zinc-900 px-3 py-1.5">Cancel</button>
                                    <button onClick={handleAddUser} disabled={!newUserName.trim()} className="bg-indigo-600 text-white text-xs font-bold px-4 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50">Save</button>
                                </div>
                            </div>
                        )}

                        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="grid grid-cols-12 bg-zinc-50/50 border-b border-zinc-100 px-6 py-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                <div className="col-span-6">User</div>
                                <div className="col-span-4">Role</div>
                                <div className="col-span-2 text-right">Actions</div>
                            </div>
                            <div className="divide-y divide-zinc-50">
                                {users.map(user => (
                                    <div key={user.id} className="grid grid-cols-12 items-center px-6 py-4 hover:bg-zinc-50/50 transition-colors">
                                        <div className="col-span-6 flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full ${user.color} flex items-center justify-center text-xs text-white font-bold`}>
                                                {user.initials}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-zinc-900">{user.name}</div>
                                                {currentUser.id === user.id && <div className="text-[10px] text-zinc-400 font-medium">You</div>}
                                            </div>
                                        </div>
                                        <div className="col-span-4">
                                            <select 
                                                value={user.role}
                                                onChange={e => updateUser(user.id, { role: e.target.value as Role })}
                                                disabled={users.length <= 1} 
                                                className="bg-transparent text-xs font-medium text-zinc-600 focus:outline-none border-none p-0 cursor-pointer hover:text-zinc-900"
                                            >
                                                <option value="Member">Member</option>
                                                <option value="Admin">Admin</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <button 
                                                onClick={() => { if(confirm('Remove this user?')) removeUser(user.id); }}
                                                disabled={users.length <= 1}
                                                className="text-zinc-300 hover:text-red-500 transition-colors p-2 disabled:opacity-0"
                                            >
                                                <Icons.Trash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    </div>
  );
};
