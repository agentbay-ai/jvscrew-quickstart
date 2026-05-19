import { useState } from 'react';
import NavSidebar from '../components/NavSidebar';
import SessionPanel from '../components/SessionPanel';
import ChatArea from '../components/ChatArea';
import SandboxPanel from '../components/SandboxPanel';
import TasksView from '../components/TasksView';
import ExpertsView from '../components/ExpertsView';
import SkillsView from '../components/SkillsView';
import FilesView from '../components/FilesView';
import TaskRunToast from '../components/TaskRunToast';

import UserProfilePopover from '../components/UserProfilePopover';
import { useChat } from '../hooks/useChat';
import { useScheduledTaskRunPolling } from '../hooks/useScheduledTaskRuns';
import { useAuthStore } from '../stores/authStore';
import { useSandboxStore } from '../stores/sandboxStore';
import type { ExpertTemplate } from '../types/api';

export default function ConsolePage() {
  const [activeTab, setActiveTab] = useState('chat');
  const [showTasks, setShowTasks] = useState(false);
  const { newChat, sendMessage } = useChat();
  const config = useAuthStore((s) => s.config);
  const setSelectedExpert = useAuthStore((s) => s.setSelectedExpert);
  const {
    sandboxPreviewOpen,
    currentResourceUrl,
    isPolling,
  } = useSandboxStore();
  useScheduledTaskRunPolling(true);

  const handleStartChat = (expert: ExpertTemplate) => {
    setSelectedExpert(expert.id ? expert : null);
    setActiveTab('chat');
    newChat();
  };

  const handleRunTask = (instruction: string) => {
    setActiveTab('chat');
    setShowTasks(false);
    void sendMessage(instruction);
  };

  return (
    <div className="h-screen w-screen flex flex-row overflow-hidden bg-white">
      <NavSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 bg-white flex items-center justify-between px-4 shrink-0 border-b border-gray-50">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex flex-col justify-center">
              <div className="flex items-center">
                <img
                  src="https://img.alicdn.com/imgextra/i3/6000000002738/O1CN01LALgaE1W63Z9D7jhW_!!6000000002738-2-gg_dtc.png"
                  alt="Logo"
                  className="w-[22px] h-5"
                />
                <img
                  src="https://img.alicdn.com/imgextra/i3/6000000006695/O1CN01vUcD4Y1zKMnTDHTQJ_!!6000000006695-2-gg_dtc.png"
                  alt="JVS Crew"
                  className="w-[72px] h-[11px] ml-1"
                />
              </div>
              <span className="text-sm text-black/40 mt-0.5">用户试用端</span>
            </div>
            {activeTab === 'experts' && (
              <span className="text-lg font-medium text-black truncate">专家</span>
            )}
            {activeTab === 'skills' && (
              <span className="text-lg font-medium text-black truncate">技能</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <UserProfilePopover>
              <div className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-black/60">{config?.externalUserId}</span>
                <img
                  src="https://img.alicdn.com/imgextra/i3/6000000004463/O1CN01L5A9k11iq6mMLtEmZ_!!6000000004463-2-gg_dtc.png"
                  alt="avatar"
                  className="w-8 h-8 rounded-full"
                />
              </div>
            </UserProfilePopover>
          </div>
        </div>

        {/* Body: SessionPanel + Content */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          {activeTab === 'chat' && (
            <SessionPanel onNewChat={newChat} onOpenTasks={() => setShowTasks(true)} onOpenFiles={() => setActiveTab('files')} />
          )}

          <div className={`flex-1 overflow-hidden ${activeTab === 'files' ? '' : 'flex flex-row gap-4 px-4 pb-2'}`}>
            {activeTab === 'chat' && (
              <>
                <div className={(sandboxPreviewOpen && currentResourceUrl) || isPolling ? 'flex-[38] min-w-[320px]' : 'flex-1 min-w-0'}>
                  <ChatArea />
                </div>
                <SandboxPanel />
              </>
            )}
            {activeTab === 'experts' && <ExpertsView onStartChat={handleStartChat} />}
            {activeTab === 'skills' && <SkillsView />}
            {activeTab === 'files' && <FilesView />}
          </div>
        </div>
      </div>

      {showTasks && (
        <TasksView
          onClose={() => setShowTasks(false)}
          onRunTask={handleRunTask}
        />
      )}

      <TaskRunToast />
    </div>
  );
}
