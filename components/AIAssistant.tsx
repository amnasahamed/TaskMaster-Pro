import React, { useState } from 'react';
import { askGemini } from '../services/geminiService';
import Card from './ui/Card';
import Button from './ui/Button';

const AIAssistant: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setResponse('');
    
    const result = await askGemini(prompt);
    
    setResponse(result || "No response received.");
    setIsLoading(false);
  };

  const suggestion = (text: string) => {
    setPrompt(text);
  };

  return (
    <div className="space-y-6 pb-20 max-h-screen overflow-hidden flex flex-col">
      <h1 className="text-2xl font-bold text-slate-800">Smart Assistant</h1>
      
      <Card className="flex-1 flex flex-col min-h-[60vh]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 rounded-lg mb-4 border border-slate-100">
            {response ? (
                 <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 mb-2">GEMINI RESPONSE</p>
                    <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-line">
                        {response}
                    </div>
                 </div>
            ) : (
                <div className="text-center text-slate-400 mt-20">
                    <p>Ask about your students, pending payments, or deadlines.</p>
                </div>
            )}
        </div>

        <div className="space-y-4">
             <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                <button onClick={() => suggestion("Draft a payment reminder for students with pending dues")} className="whitespace-nowrap px-3 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:bg-slate-50 hover:border-blue-300">💰 Payment Reminder</button>
                <button onClick={() => suggestion("Which writers have no active assignments?")} className="whitespace-nowrap px-3 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:bg-slate-50 hover:border-blue-300">✍️ Available Writers</button>
                <button onClick={() => suggestion("Summarize all deadlines for this week")} className="whitespace-nowrap px-3 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-600 hover:bg-slate-50 hover:border-blue-300">📅 Weekly Deadlines</button>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
                <input 
                    type="text" 
                    className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ask TaskMaster AI..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading}>
                    {isLoading ? '...' : 'Ask'}
                </Button>
            </form>
        </div>
      </Card>
    </div>
  );
};

export default AIAssistant;