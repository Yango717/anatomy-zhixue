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

        const completedType = autoPilotPendingCheckin.activity?.type;

        // Fallback: local checkin with type-specific guidance
        if (!checkinMsg) {
          // Practice completed → all done!
          if (completedType === 'practice') {
            checkinMsg = {
              message: '今天任务圆满完成啦！🎉 你好棒！学到的知识又扎实了一分～明天继续加油喔！',
              actions: [],
            };
          } else if (nextStep) {
            // Use type-specific guidance messages
            const guidanceMap = {
              review_yesterday_errors: {
                message: '昨日错题回顾完毕！温故知新，现在开始今天的学习吧～',
                actions: [{ label: nextStep.actionLabel || '去学习', route: nextStep.route }],
              },
              learn: {
                message: '学得不错！图谱和闪卡都过了一遍，现在来个小测验检验一下～',
                actions: [{ label: nextStep.actionLabel || '去测验', route: nextStep.route }],
              },
              quiz: {
                message: '测验完成！来看看哪些知识点还需要加强，错题趁热回顾一下～',
                actions: [{ label: nextStep.actionLabel || '去错题回顾', route: nextStep.route }],
              },
              error_review: {
                message: '错题搞定啦！知识点巩固好了，现在去刷题界面练练手吧～',
                actions: [{ label: nextStep.actionLabel || '去刷题', route: nextStep.route }],
              },
              practice: {
                message: '去刷题吧！想做多少做多少，学姐陪着你～退出就代表今天完成啦！',
                actions: [{ label: nextStep.actionLabel || '去刷题', route: nextStep.route }],
              },
              test: {
                message: '测试完成！看看错题回顾，然后去刷题练手巩固一下～',
                actions: [{ label: nextStep.actionLabel || '继续', route: nextStep.route }],
              },
            };

            const guidance = guidanceMap[completedType] || {
              message: nextStep.message || `接下来：${nextStep.title}`,
              actions: [{ label: nextStep.actionLabel || '继续', route: nextStep.route }],
            };
            checkinMsg = guidance;
          } else if (nextIdx >= (plan?.steps?.length || 0)) {
            // All steps complete (reached end of plan)
            checkinMsg = {
              message: '今天的学习计划全部完成啦！🎉 你好棒！明天继续加油喔～',
              actions: [],
            };
          } else {
            checkinMsg = {
              message: '学得不错！继续加油～有什么想问的随时找我喔！',
              actions: [],
            };
          }
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
