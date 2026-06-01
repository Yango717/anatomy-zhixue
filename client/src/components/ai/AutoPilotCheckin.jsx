import { useEffect, useRef } from 'react';
import { useAIContext } from './AIContextProvider';
import useAITutor from '../../hooks/useAITutor';

export default function AutoPilotCheckin() {
  const {
    autoPilotEnabled,
    autoPilotPlan,
    autoPilotStepIndex,
    autoPilotPendingCheckin,
    autoPilotThreadId,
    advanceAutoPilotStep,
    markCheckinDelivered,
    saveAutoPilotThreadId,
    saveThreadMessages,
    threads,
    createThread,
  } = useAIContext();

  const tutor = useAITutor([]);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!autoPilotEnabled) return;
    if (!autoPilotPendingCheckin) return;
    if (autoPilotPendingCheckin.delivered) return;
    if (processingRef.current) return;

    processingRef.current = true;

    async function deliverCheckin() {
      try {
        const plan = autoPilotPlan;
        const nextIdx = autoPilotStepIndex + 1;
        const nextStep = plan?.steps?.[nextIdx];

        // Try AI-generated checkin first
        let checkinMsg = null;
        try {
          const result = await tutor.generateNextCheckin(
            autoPilotPendingCheckin.activity,
            plan
          );
          if (result?.message) {
            checkinMsg = result;
          }
        } catch {}

        // Fallback: local checkin based on plan
        if (!checkinMsg && nextStep) {
          checkinMsg = {
            message: nextStep.message || `接下来：${nextStep.title}`,
            actions: [
              { label: nextStep.actionLabel || '继续', route: nextStep.route },
            ],
          };
        }

        // Fallback: all steps complete
        if (!checkinMsg && nextIdx >= (plan?.steps?.length || 0)) {
          checkinMsg = {
            message: '今天的学习计划全部完成啦！🎉 你好棒！明天继续加油喔～',
            actions: [],
          };
        }

        // Fallback: no plan
        if (!checkinMsg) {
          checkinMsg = {
            message: '学得不错！继续加油～有什么想问的随时找我喔！',
            actions: [],
          };
        }

        // Get or create autoPilot thread
        let threadId = autoPilotThreadId;
        if (!threadId) {
          threadId = createThread();
          saveAutoPilotThreadId(threadId);
          // Rename thread
          const thread = threads.find((t) => t.id === threadId);
          if (thread) {
            saveThreadMessages(threadId, []);
          }
        }

        // Build action-augmented message
        const actionText = checkinMsg.actions?.length
          ? '\n\n' + checkinMsg.actions.map((a, i) => `[action:${a.label}:${a.route}]`).join(' ')
          : '';

        const msg = {
          role: 'assistant',
          content: checkinMsg.message + actionText,
          _actions: checkinMsg.actions || [],
        };

        // Get existing thread messages
        const existingThread = threads.find((t) => t.id === threadId);
        const existingMsgs = existingThread?.messages || [];
        saveThreadMessages(threadId, [...existingMsgs, msg]);

        // Advance step and mark delivered
        advanceAutoPilotStep();
        markCheckinDelivered();
      } catch {
        // Still mark as delivered to prevent infinite loop
        markCheckinDelivered();
      } finally {
        processingRef.current = false;
      }
    }

    deliverCheckin();
  }, [autoPilotPendingCheckin]);

  // This component renders nothing — it's a logic-only subscriber
  return null;
}
