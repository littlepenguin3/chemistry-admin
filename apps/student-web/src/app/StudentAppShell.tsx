import { CSSProperties, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Atom,
  BookOpenCheck,
  ChevronRight,
  ClipboardList,
  FlaskConical,
  Layers3,
  LoaderCircle,
  LogOut,
  MessageCircle,
  Paperclip,
  PlayCircle,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { assistantEnabled, defaultStudentAppConfig, feedbackEnabled } from "./appConfig";
import { StudentAiChatTab } from "../features/assistant/StudentAiChatTab";
import { defaultAssistantContext, type AssistantContext } from "../features/assistant/assistantContext";
import { StudentFeedbackForm } from "../features/feedback/StudentFeedbackForm";
import { AssessmentHomePanel } from "../features/assessment/AssessmentHomePanel";
import { PosttestPanel } from "../features/assessment/PosttestPanel";
import { PosttestSummaryPanel } from "../features/assessment/PosttestSummaryPanel";
import { ExperimentsOverviewPanel } from "../features/experiments/ExperimentsOverviewPanel";
import { ExperimentGroupPanel } from "../features/experiments/ExperimentGroupPanel";
import { ExperimentDetailPanel } from "../features/experiments/ExperimentDetailPanel";
import { stripExperimentPrefix } from "../features/experiments/experimentFormat";
import { FinishLearningAction } from "../shared/learning/FinishLearningAction";
import { LearningState } from "../shared/mobile/LearningState";
import { compactText } from "../shared/utils/text";
import { LearningEntryPanel } from "../features/learning/LearningEntryPanel";
import { LearningHomePanel } from "../features/learning/LearningHomePanel";
import { formatChapterEntryTitle } from "../features/learning/learningFormat";
import {
  elementEnglishName,
  elementTileStyle,
  firstEnabledArea,
  firstGroupForArea,
  normalizeAreaId,
  periodicAreaByAreaId,
  profileAreaId,
  type AreaId,
} from "../features/periodic-table/periodicHelpers";
import type { FeedbackContext } from "../features/feedback/feedbackTypes";
import type { AssessmentRoute, ChapterLearningView, ExperimentTabRoute, LearningRoute, StudentTab } from "./routes";
import { AssessmentPanel, type AnswerMap } from "../features/pretest/AssessmentPanel";
import {
  AuthUser,
  StudentAppConfigResponse,
  StudentExperimentGroupResponse,
  StudentExperimentGroupSummary,
  StudentLearningChapterExperimentGroup,
  StudentLearningElementBadge,
  StudentLearningPageResponse,
  StudentLearningPointCard,
  StudentLearningPointGroup,
  StudentLearningProfile,
  StudentLearningProfileSummary,
  StudentLearningPropertyCard,
  StudentLearningPropertySection,
  StudentPosttestResponse,
  errorMessage,
  getStudentAppConfig,
  getStudentLearningPage,
  startStudentPosttest,
  studentMediaUrl,
  submitStudentPosttest,
} from "../api";
import { MobileButton, MobileEmptyState, MobileField } from "../mobile/primitives";

type LearningHeaderMeta = {
  profileId: string;
  chapterId?: string | null;
  title: string;
  subtitle: string;
  summary: string;
};

type ExperimentHeaderMeta = {
  parentCode: string;
  chapterId?: string | null;
  title: string;
  subtitle: string;
  summary: string;
};

function learningHeaderMetaForProfile(profile: StudentLearningProfile | StudentLearningProfileSummary): LearningHeaderMeta {
  const title = formatChapterEntryTitle(profile);
  const subtitle = compactText(["当前章节", profile.subtitle].filter(Boolean));
  const summary = compactText([
    profile.subtitle,
    profile.family_name,
    profile.element_symbols.length ? `元素：${profile.element_symbols.join("、")}` : "",
  ]);
  return {
    profileId: profile.profile_id,
    chapterId: profile.chapter_id,
    title,
    subtitle,
    summary: summary || title,
  };
}

function experimentHeaderMetaForSummary(group: StudentExperimentGroupSummary): ExperimentHeaderMeta {
  const title = stripExperimentPrefix(group.parent_title);
  const subtitle = compactText(["当前实验模块", group.area_name].filter(Boolean));
  const summary = compactText([
    group.parent_title,
    group.area_name,
    `${group.experiment_count} 个实验点`,
    `${group.question_count} 道练习`,
  ]);
  return {
    parentCode: group.parent_code,
    chapterId: group.chapter_ids[0] || null,
    title,
    subtitle,
    summary: summary || title,
  };
}

function experimentHeaderMetaForGroup(group: StudentExperimentGroupResponse): ExperimentHeaderMeta {
  const title = stripExperimentPrefix(group.parent_title);
  const summary = compactText([
    `实验模块：${group.parent_title}`,
    `所属区域：${group.area_name}`,
    group.experiments.length ? `实验点：${group.experiments.map((experiment) => experiment.title).join("、")}` : null,
  ]);
  return {
    parentCode: group.parent_code,
    chapterId: group.experiments[0]?.chapter_ids[0] || null,
    title,
    subtitle: compactText(["当前实验模块", group.area_name].filter(Boolean)),
    summary: summary || title,
  };
}

export function StudentAppShell({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<StudentTab>("learn");
  const [learningRoute, setLearningRoute] = useState<LearningRoute>({ screen: "entry" });
  const [learningHeaderMeta, setLearningHeaderMeta] = useState<LearningHeaderMeta | null>(null);
  const [assessmentRoute, setAssessmentRoute] = useState<AssessmentRoute>({ screen: "home" });
  const [experimentRoute, setExperimentRoute] = useState<ExperimentTabRoute>({ screen: "overview" });
  const [experimentHeaderMeta, setExperimentHeaderMeta] = useState<ExperimentHeaderMeta | null>(null);
  const [assistantContext, setAssistantContext] = useState<AssistantContext>(() => defaultAssistantContext());
  const [appConfig, setAppConfig] = useState<StudentAppConfigResponse>(defaultStudentAppConfig);
  const [configError, setConfigError] = useState("");
  const [posttestLoading, setPosttestLoading] = useState(false);
  const [posttestSubmitting, setPosttestSubmitting] = useState(false);
  const [posttestError, setPosttestError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const refreshConfig = async () => {
      try {
        const response = await getStudentAppConfig();
        if (!cancelled) {
          setAppConfig(response);
          setConfigError("");
        }
      } catch (requestError) {
        if (!cancelled) setConfigError(errorMessage(requestError));
      }
    };
    void refreshConfig();
    const handleVisible = () => {
      if (document.visibilityState !== "hidden") void refreshConfig();
    };
    window.addEventListener("focus", handleVisible);
    document.addEventListener("visibilitychange", handleVisible);
    const timer = window.setInterval(refreshConfig, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleVisible);
      document.removeEventListener("visibilitychange", handleVisible);
      window.clearInterval(timer);
    };
  }, []);

  const finishLearning = async () => {
    setPosttestLoading(true);
    setPosttestError("");
    try {
      const response = await startStudentPosttest();
      setAssessmentRoute({ screen: "posttest", posttest: response });
      setActiveTab("assessment");
    } catch (requestError) {
      setPosttestError(errorMessage(requestError));
    } finally {
      setPosttestLoading(false);
    }
  };

  const submitPosttest = async (posttest: StudentPosttestResponse, answers: AnswerMap) => {
    setPosttestSubmitting(true);
    setPosttestError("");
    try {
      const response = await submitStudentPosttest(
        posttest.session_id,
        Object.entries(answers).map(([questionId, answer]) => ({ question_id: questionId, answer })),
      );
      setAssessmentRoute({ screen: "summary", report: response.report });
      setActiveTab("assessment");
    } catch (requestError) {
      setPosttestError(errorMessage(requestError));
    } finally {
      setPosttestSubmitting(false);
    }
  };

  const canUseAssistant = assistantEnabled(appConfig.features);
  const canUseFeedback = feedbackEnabled(appConfig.features);

  useEffect(() => {
    if (!canUseAssistant && activeTab === "assistant") {
      setActiveTab("learn");
    }
  }, [activeTab, canUseAssistant]);

  const switchTab = (tab: StudentTab) => {
    if (tab === "assistant" && !canUseAssistant) return;
    setActiveTab(tab);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  };

  const openAssistant = (context: AssistantContext) => {
    if (!canUseAssistant) return;
    setAssistantContext(context);
    setActiveTab("assistant");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  };

  const rememberLearningProfile = useCallback((profile: StudentLearningProfile) => {
    setLearningHeaderMeta(learningHeaderMetaForProfile(profile));
  }, []);

  const chooseAnotherChapter = () => {
    setLearningRoute({ screen: "entry" });
    setLearningHeaderMeta(null);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  };

  const openCurrentChapterAssistant = () => {
    if (!learningHeaderMeta) return;
    openAssistant({
      context_type: "learning_profile",
      context_title: learningHeaderMeta.title,
      context_summary: learningHeaderMeta.summary,
      chapter_id: learningHeaderMeta.chapterId,
      prompts: ["帮我梳理本章重点", "我该先复习哪一块？", "解释一个本章实验现象"],
    });
  };

  const rememberExperimentGroup = useCallback((group: StudentExperimentGroupResponse) => {
    setExperimentHeaderMeta(experimentHeaderMetaForGroup(group));
  }, []);

  const chooseAnotherExperimentGroup = () => {
    setExperimentRoute({ screen: "overview" });
    setExperimentHeaderMeta(null);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
  };

  const openCurrentExperimentAssistant = () => {
    if (!experimentHeaderMeta) return;
    openAssistant({
      context_type: "experiment_group",
      context_title: experimentHeaderMeta.title,
      context_summary: experimentHeaderMeta.summary,
      chapter_id: experimentHeaderMeta.chapterId,
      prompts: ["这一组实验重点是什么？", "我应该按什么顺序看？", "这组实验会考什么现象？"],
    });
  };

  const renderLearning = () => {
    if (learningRoute.screen === "point") {
      return (
        <ExperimentDetailPanel
          experimentId={learningRoute.experimentId}
          profileId={learningRoute.profileId}
          propertyKey={learningRoute.propertyKey}
          propertyTitle={learningRoute.propertyTitle}
          elementSymbol={learningRoute.elementSymbol}
          chapterView={learningRoute.chapterView}
          pointKey={learningRoute.pointKey}
          pointTitle={learningRoute.pointTitle}
          onBack={() =>
            setLearningRoute({
              screen: "chapter",
              profileId: learningRoute.profileId,
              propertyKey: learningRoute.propertyKey,
              elementSymbol: learningRoute.elementSymbol,
              chapterView: learningRoute.chapterView || "experiments",
            })
          }
          onFinishLearning={finishLearning}
          finishing={posttestLoading}
          finishError={posttestError}
          assistantEnabled={canUseAssistant}
          onOpenAssistant={openAssistant}
        />
      );
    }

    if (learningRoute.screen === "entry") {
      return (
        <LearningEntryPanel
          onSelectProfile={(profile) => {
            setLearningHeaderMeta(learningHeaderMetaForProfile(profile));
            setLearningRoute({ screen: "chapter", profileId: profile.profile_id });
          }}
        />
      );
    }

    return (
      <LearningHomePanel
        profileId={learningRoute.profileId}
        initialPropertyKey={learningRoute.propertyKey}
        initialElementSymbol={learningRoute.elementSymbol}
        initialChapterView={learningRoute.chapterView}
        onProfileLoaded={rememberLearningProfile}
        onSelectPoint={(point) =>
          setLearningRoute({
            screen: "point",
            profileId: point.profileId,
            propertyKey: point.propertyKey,
            propertyTitle: point.propertyTitle,
            elementSymbol: point.elementSymbol,
            chapterView: point.chapterView,
            experimentId: point.experimentId,
            pointKey: point.pointKey,
            pointTitle: point.pointTitle,
          })
        }
        onFinishLearning={finishLearning}
        finishing={posttestLoading}
        finishError={posttestError}
      />
    );
  };

  const renderExperiments = () => {
    if (experimentRoute.screen === "group") {
      return (
        <ExperimentGroupPanel
          parentCode={experimentRoute.parentCode}
          onGroupLoaded={rememberExperimentGroup}
          onSelectExperiment={(experimentId) => setExperimentRoute({ screen: "detail", parentCode: experimentRoute.parentCode, experimentId })}
          onFinishLearning={finishLearning}
          finishing={posttestLoading}
          finishError={posttestError}
        />
      );
    }
    if (experimentRoute.screen === "detail") {
      return (
        <ExperimentDetailPanel
          experimentId={experimentRoute.experimentId}
          onBack={() =>
            setExperimentRoute(experimentRoute.parentCode ? { screen: "group", parentCode: experimentRoute.parentCode } : { screen: "overview" })
          }
          onFinishLearning={finishLearning}
          finishing={posttestLoading}
          finishError={posttestError}
          assistantEnabled={canUseAssistant}
          onOpenAssistant={openAssistant}
        />
      );
    }
    return (
      <ExperimentsOverviewPanel
        onSelectGroup={(group) => {
          setExperimentHeaderMeta(experimentHeaderMetaForSummary(group));
          setExperimentRoute({ screen: "group", parentCode: group.parent_code });
        }}
      />
    );
  };

  const renderAssessment = () => {
    if (assessmentRoute.screen === "posttest") {
      return (
        <PosttestPanel
          posttest={assessmentRoute.posttest}
          submitting={posttestSubmitting}
          error={posttestError}
          onSubmit={(answers) => submitPosttest(assessmentRoute.posttest, answers)}
        />
      );
    }
    if (assessmentRoute.screen === "summary") {
      return (
        <PosttestSummaryPanel
          report={assessmentRoute.report}
          onContinue={() => {
            setAssessmentRoute({ screen: "home" });
            setLearningRoute({ screen: "entry" });
            setActiveTab("learn");
          }}
        />
      );
    }
    return <AssessmentHomePanel />;
  };

  const activeMeta = studentTabMeta[activeTab];
  const isLearningChapterRoute = activeTab === "learn" && learningRoute.screen !== "entry";
  const isExperimentModuleRoute = activeTab === "experiments" && experimentRoute.screen !== "overview";
  const headerMeta =
    isLearningChapterRoute && learningHeaderMeta
      ? { title: learningHeaderMeta.title, subtitle: learningHeaderMeta.subtitle }
      : isExperimentModuleRoute && experimentHeaderMeta
        ? { title: experimentHeaderMeta.title, subtitle: experimentHeaderMeta.subtitle }
      : activeMeta;
  const headerActions = isLearningChapterRoute ? (
    <div className="student-app-header-actions" aria-label="章节操作">
      {canUseAssistant ? (
        <button className="student-app-header-action" type="button" onClick={openCurrentChapterAssistant}>
          <MessageCircle size={18} />
          <span>去问答</span>
        </button>
      ) : null}
      <button className="student-app-header-action" type="button" onClick={chooseAnotherChapter}>
        <Atom size={18} />
        <span>换章节</span>
      </button>
    </div>
  ) : null;
  const experimentHeaderActions = isExperimentModuleRoute ? (
    <div className="student-app-header-actions" aria-label="实验章节操作">
      {canUseAssistant && experimentHeaderMeta ? (
        <button className="student-app-header-action" type="button" onClick={openCurrentExperimentAssistant}>
          <MessageCircle size={18} />
          <span>去问答</span>
        </button>
      ) : null}
      <button className="student-app-header-action" type="button" onClick={chooseAnotherExperimentGroup}>
        <Atom size={18} />
        <span>换章节</span>
      </button>
    </div>
  ) : null;
  const effectiveHeaderActions = experimentHeaderActions || headerActions;
  const navItems = studentTabItems(canUseAssistant);
  const content =
    activeTab === "learn"
      ? renderLearning()
      : activeTab === "experiments"
        ? renderExperiments()
        : activeTab === "assistant"
          ? <StudentAiChatTab context={assistantContext} onResetContext={() => setAssistantContext(defaultAssistantContext())} />
          : activeTab === "assessment"
            ? renderAssessment()
            : <ProfileTabPanel user={user} feedbackEnabled={canUseFeedback} onLogout={onLogout} />;

  return (
    <section className="student-app-shell" aria-label="学生学习应用">
      <StudentAppHeader title={headerMeta.title} subtitle={headerMeta.subtitle} actions={effectiveHeaderActions} />
      {configError ? <div className="form-hint app-config-hint">配置刷新失败，当前页面会继续使用上一次配置：{configError}</div> : null}
      <div className="student-tab-content">{content}</div>
      <StudentBottomNav items={navItems} activeTab={activeTab} onChange={switchTab} />
    </section>
  );
}

const studentTabMeta: Record<StudentTab, { title: string; subtitle: string }> = {
  learn: { title: "学习", subtitle: "章节与元素周期表" },
  experiments: { title: "实验", subtitle: "资源与点位" },
  assistant: { title: "问答", subtitle: "AI 学习助手" },
  assessment: { title: "测评", subtitle: "后测与报告" },
  profile: { title: "我的", subtitle: "账号与反馈" },
};

function studentTabItems(canUseAssistant: boolean): Array<{ key: StudentTab; label: string; icon: ReactNode }> {
  return [
    { key: "learn", label: "学习", icon: <BookOpenCheck size={20} /> },
    { key: "experiments", label: "实验", icon: <FlaskConical size={20} /> },
    ...(canUseAssistant ? [{ key: "assistant" as const, label: "问答", icon: <MessageCircle size={20} /> }] : []),
    { key: "assessment", label: "测评", icon: <ClipboardList size={20} /> },
    { key: "profile", label: "我的", icon: <UserRound size={20} /> },
  ];
}

function StudentAppHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <header className={actions ? "student-app-header has-actions" : "student-app-header"}>
      <div>
        <p>{subtitle}</p>
        <h1>{title}</h1>
      </div>
      {actions}
    </header>
  );
}

function StudentBottomNav({
  items,
  activeTab,
  onChange,
}: {
  items: Array<{ key: StudentTab; label: string; icon: ReactNode }>;
  activeTab: StudentTab;
  onChange: (tab: StudentTab) => void;
}) {
  return (
    <nav className="student-bottom-nav" aria-label="学生端主导航">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={activeTab === item.key ? "active" : ""}
          aria-current={activeTab === item.key ? "page" : undefined}
          onClick={() => onChange(item.key)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function ProfileTabPanel({
  user,
  feedbackEnabled,
  onLogout,
}: {
  user: AuthUser;
  feedbackEnabled: boolean;
  onLogout: () => void;
}) {
  return (
    <section className="learning-panel profile-tab-panel" aria-label="我的">
      <section className="profile-card">
        <span className="panel-icon">
          <UserRound size={20} />
        </span>
        <div>
          <p>{user.student_id || user.username}</p>
          <h2>{user.display_name}</h2>
          {user.class_name ? <small>{user.class_name}</small> : null}
        </div>
      </section>
      {feedbackEnabled ? (
        <StudentFeedbackForm
          context={{
            pagePath: "/student/profile/feedback",
            contextTitle: "学生端反馈",
            metadata: { screen: "profile_feedback" },
          }}
        />
      ) : (
        <MobileEmptyState className="empty-learning-card" icon={<ClipboardList size={20} />}>
          <span>反馈入口已关闭</span>
        </MobileEmptyState>
      )}
      <MobileButton className="secondary-action full profile-logout-action" type="button" variant="secondary" onClick={onLogout}>
        <LogOut size={18} />
        <span>退出登录</span>
      </MobileButton>
    </section>
  );
}
