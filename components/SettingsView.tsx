import React, { useRef } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import { useToast } from './Layout';
import * as DataService from '../services/dataService';

const SettingsView: React.FC = () => {
    const { addToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleBackup = async () => {
        const data = await DataService.getExportData();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `taskmaster_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        addToast('Backup downloaded successfully', 'success');
    };

    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            if (await DataService.importData(content)) {
                addToast('Data restored successfully! reloading...', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                addToast('Failed to restore data. Invalid file.', 'error');
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    const handleResetApp = async () => {
        if (confirm('DANGER: This will wipe all your data permanently. Are you absolutely sure?')) {
            if (confirm('Last Warning: Cannot be undone. Type "YES" to confirm.')) {
                await DataService.clearAllData();
                window.location.reload();
            }
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-2xl font-bold text-slate-900">Settings</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <Card title="Data Management">
                    <div className="space-y-4">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <h4 className="font-bold text-blue-900 mb-1">Backup Your Business</h4>
                            <p className="text-sm text-blue-700 mb-3">
                                Your data is currently stored only on this device. Download a backup file regularly to prevent data loss.
                            </p>
                            <Button onClick={handleBackup} className="w-full justify-center">
                                Download Backup (.json)
                            </Button>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <h4 className="font-bold text-slate-900 mb-1">Restore Data</h4>
                            <p className="text-sm text-slate-500 mb-3">
                                Restore from a previously saved .json file. This will overwrite current data.
                            </p>
                            <input
                                type="file"
                                accept=".json"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <Button variant="secondary" onClick={handleRestoreClick} className="w-full justify-center">
                                Upload Backup File
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card title="App Info">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-500">App Name</span>
                            <span className="font-semibold">TaskMaster Pro</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-500">Version</span>
                            <span className="font-semibold">1.2.0</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100">
                            <span className="text-slate-500">Currency</span>
                            <span className="font-semibold">INR (₹)</span>
                        </div>
                        <div className="pt-6">
                            <button
                                onClick={handleResetApp}
                                className="w-full py-3 rounded-xl border-2 border-red-100 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors"
                            >
                                Reset Application (Wipe Data)
                            </button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default SettingsView;