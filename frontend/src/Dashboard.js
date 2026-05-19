import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { config } from './config';
import { apiFetch, getSupabaseAccessToken, AUTH_REQUIRED } from './apiClient';
import { supabase } from './supabaseClient';
import Header from './Header';
import analyticsService from './services/analyticsService';
import { exportResearchToPDF } from './utils/exportResearchPdf';
import { getUserFirstName } from './utils/userDisplayName';
import { TipCard } from './components/TipCard';
import BetaReviewModal from './components/BetaReviewModal';
import { handleBetaReviewSubmit, shouldShowBetaReview, clearBetaReviewFlag } from './utils/betaReviewUtils';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const DASHBOARD_SESSION_CACHE_KEY = 'dr-dashboard-cache-v2';

function normalizeUsageFromApi(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    reports_used: Number(data.reports_used) || 0,
    reports_limit: data.reports_limit == null ? null : Number(data.reports_limit),
    reports_remaining: data.reports_remaining == null ? null : Number(data.reports_remaining),
    is_admin: Boolean(data.is_admin),
    reports_quota_locked: Boolean(data.reports_quota_locked),
    sources_cited_total: Number(data.sources_cited_total) || 0,
  };
}

// Icon components (simplified versions for the new design)
const Icon = {
  Plus: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Download: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  Arrow: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
};

// Helper Components for the new design
const SideLink = ({ icon, label, onClick }) => {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 8px', borderRadius: 6, border: 'none',
      background: 'transparent', color: 'var(--mut)', cursor: 'pointer',
      textAlign: 'left', fontSize: 13, fontFamily: 'Geist, sans-serif',
    }}>
      {icon} <span>{label}</span>
    </button>
  );
};

/** Same order as `BigStat` tints; cycling by index never places identical colors on adjacent rows. */
const REPORT_ROW_ACCENT_TINTS = ['var(--violet)', 'var(--cyan)', 'var(--hot)', 'var(--sun)'];

const BigStat = ({ n, l, tint }) => {
  return (
    <div className="card" style={{ padding: 14, position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: 3, height: '100%',
        background: tint,
      }}/>
      <div className="serif" style={{ fontSize: 32, lineHeight: 1, letterSpacing: '-.025em' }}>{n}</div>
      <div className="mono" style={{ marginTop: 3, fontSize: 9, color: 'var(--mut)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{l}</div>
    </div>
  );
};

const FrameDivider = ({ label }) => {
  return (
    <div style={{ 
      display: 'flex', alignItems: 'center', marginBottom: 16,
      padding: '8px 0', borderBottom: '1px solid var(--line)',
    }}>
      <span className="mono" style={{ fontSize: 11, color: 'var(--mut2)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
};

const DashboardTipCard = ({ style = {} }) => (
  <TipCard
    style={style}
    title={
      <>
        <span style={{ fontStyle: 'italic' }}>tip:</span> drag a report into a folder.
      </>
    }
    subtitle="A quick way to organise your workflow."
  />
);

/** Beta blurb below library search: bigger type, no second card — reads as helper copy. */
const DashboardBetaSearchBlurb = () => (
  <div>
    <p
      className="serif"
      style={{
        margin: 0,
        fontSize: 'clamp(17px, 2.1vw, 23px)',
        lineHeight: 1.38,
        letterSpacing: '-0.01em',
        fontWeight: 600,
        color: 'var(--fg)',
      }}
    >
      We&apos;re in{' '}
      <span style={{ fontStyle: 'italic' }}>
        <span className="marker-half" style={{ color: 'var(--fg)' }}>
          beta
        </span>
      </span>{' '}
      — so for now, everyone gets{' '}
      <span style={{ fontStyle: 'italic' }}>
        <span className="marker-half" style={{ color: 'var(--fg)' }}>
          five
        </span>
      </span>
      .
    </p>
    <p
      className="serif"
      style={{
        margin: '10px 0 0',
        fontSize: 'clamp(15px, 1.65vw, 18px)',
        lineHeight: 1.45,
        fontStyle: 'italic',
        color: 'var(--mut)',
      }}
    >
      Small batch, big ideas.
    </p>
  </div>
);

const DroppableFolderTarget = ({ dropId, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  return (
    <div
      ref={setNodeRef}
      style={{
        borderRadius: 8,
        outline: isOver ? '2px solid var(--cyan)' : 'none',
        outlineOffset: 2,
        transition: 'outline 0.12s ease',
      }}
    >
      {children}
    </div>
  );
};

/** Row kind: comparisons use titles prefixed with `Comparison:` (backend `compare_articles`). */
function conversationRowKind(conv) {
  const t = (conv?.title || '').trimStart();
  return /^comparison:/i.test(t) ? 'comparison' : 'report';
}

function conversationKindDotColor(kind) {
  return kind === 'comparison' ? 'var(--kind-comparison)' : 'var(--kind-report)';
}

/** Match sidebar folder dots for the row swatch (All research → `var(--mut2)`). */
function folderMetaForConversation(conv, folders) {
  const fid = conv?.folder_id;
  if (fid == null || fid === '') {
    return { name: 'All research', color: 'var(--mut2)' };
  }
  const matched = folders.find(
    (x) => x.id === fid || String(x.id) === String(fid),
  );
  return matched
    ? { name: matched.name, color: matched.color }
    : { name: 'All research', color: 'var(--mut2)' };
}

/** Report row with drag handle; folders accept drops via DroppableFolderTarget. */
const DraggableReportRow = ({ r, folders, onOpen, onDelete, accentTint }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: r.id,
  });

  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 1 : undefined,
    position: 'relative',
    overflow: 'hidden',
  };

  const folder = folderMetaForConversation(r, folders);
  const rowKind = conversationRowKind(r);
  const rowKindLabel = rowKind === 'comparison' ? 'comparison' : 'report';

  const handleCardClick = (e) => {
    if (e.target.closest('.action-button') || e.target.closest('.drag-handle')) return;
    onOpen(r);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(r);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card"
      {...attributes}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 4,
          height: '100%',
          background: accentTint,
        }}
      />
      <div
        role="presentation"
        onClick={handleCardClick}
        style={{
          padding: '12px 14px',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'grid',
          gridTemplateColumns: '20px 20px 1fr auto auto',
          gap: 10,
          alignItems: 'center',
          width: '100%',
        }}
      >
        <button
          type="button"
          className="drag-handle"
          aria-label="Drag to move to folder"
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: 4,
            margin: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--mut2)',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="9" cy="7" r="1.25" />
            <circle cx="9" cy="12" r="1.25" />
            <circle cx="9" cy="17" r="1.25" />
            <circle cx="15" cy="7" r="1.25" />
            <circle cx="15" cy="12" r="1.25" />
            <circle cx="15" cy="17" r="1.25" />
          </svg>
        </button>
        <div
          style={{
            width: 18,
            height: 24,
            borderRadius: 3,
            background: folder.color,
            opacity: 0.9,
            boxShadow: `0 6px 14px -8px ${folder.color}`,
          }}
        />
        <div>
          <div className="serif" style={{ fontSize: 18, lineHeight: 1.2, letterSpacing: '-.01em' }}>
            {r.title}
          </div>
          <div className="mono" style={{ marginTop: 4, fontSize: 11, color: 'var(--mut2)', letterSpacing: '.04em' }}>
            {folder.name.toLowerCase()} · {new Date(r.created_at).toLocaleDateString()}
          </div>
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--mut)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: conversationKindDotColor(rowKind) }} />
          {rowKindLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handleDelete}
            className="action-button"
            style={{
              padding: 4,
              border: 'none',
              background: 'transparent',
              color: 'var(--mut2)',
              cursor: 'pointer',
              borderRadius: 4,
            }}
            title="Delete research"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <Icon.Arrow />
        </div>
      </div>
    </div>
  );
};


const getTimeOfDayGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  if (hour < 5) return 'Good morning';
  return 'Good evening';
};

const getResearcherQuote = () => {
  const quotes = [
    "Discovery consists of seeing what everybody has seen and thinking what nobody has thought.",
    "Research is what I'm doing when I don't know what I'm doing.",
    "The important thing is not to stop questioning. Curiosity has its own reason for existing.",
    "In research, the front line is almost always in a fog.",
    "The best way to have a good idea is to have lots of ideas.",
    "Research is creating new knowledge.",
    "The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.",
    "Knowledge is power. Information is liberating. Education is the premise of progress.",
  ];
  const today = new Date();
  const dayIndex = today.getDate() % quotes.length;
  return quotes[dayIndex];
};

const Dashboard = () => {
  const [folders, setFolders] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6');
  const [loading, setLoading] = useState(true);
  const [allConversations, setAllConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // 'conversation' or 'folder'
  const [showEditFolderModal, setShowEditFolderModal] = useState(false);
  const [editFolderData, setEditFolderData] = useState(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderColor, setEditFolderColor] = useState('#3B82F6');
  const [usage, setUsage] = useState({
    reports_used: 0,
    reports_limit: 5,
    reports_remaining: 5,
    is_admin: false,
    reports_quota_locked: false,
    sources_cited_total: 0,
  });
  const [userProfile, setUserProfile] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSelectedId, setExportSelectedId] = useState(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [showBetaReviewModal, setShowBetaReviewModal] = useState(false);
  const [showQuotaLimitModal, setShowQuotaLimitModal] = useState(false);

  const { token, user, syncUsageQuotaFromApi, researchCreationBlocked, usageQuota } = useAuth();
  const navigate = useNavigate();
  const [dashboardStartTime] = useState(Date.now());

  const isAdminUser = Boolean(usage.is_admin);

  const profileRoleNorm =
    userProfile?.role != null
      ? String(userProfile.role).trim().toLowerCase()
      : null;
  /** Standard accounts see beta quota copy; admins are exempt. */
  const showUserRoleReportLimitHeading =
    !isAdminUser && profileRoleNorm !== 'admin';

  const monthlyReportLimit =
    usage.reports_limit != null ? Number(usage.reports_limit) : null;
  /** Admin accounts omit ``reports_limit`` from API; use 5 for lock / beta copy fallback. */
  const quotaCopyReportCap = monthlyReportLimit ?? 5;
  const reportsNoun = (n) =>
    n === 1 ? 'report' : 'reports';

  /** Cap subtitle uses Auth quota only (never local ``usage`` defaults). */
  const quotaHeadingLimit =
    usageQuota.loaded && usageQuota.reports_limit != null
      ? usageQuota.reports_limit
      : quotaCopyReportCap;

  /** Matches `/usage` + Auth — lock or threads at limit (not lagging Dashboard ``usage`` state). */
  const quotaCapReachedFromApi =
    usageQuota.loaded &&
    (usageQuota.reports_quota_locked ||
      (!usageQuota.is_admin &&
        usageQuota.reports_limit != null &&
        usageQuota.reports_used >= usageQuota.reports_limit));

  const showQuotaCapSubtitle = quotaCapReachedFromApi;

  /** Loaded admins who are not capped still see the unlimited line. */
  const showAdminUnlimitedSubtitle =
    usageQuota.loaded && usageQuota.is_admin && !quotaCapReachedFromApi;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const colors = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#06B6D4',
    '#84CC16',
    '#F97316',
    '#EC4899',
    '#14B8A6',
    '#6366F1',
    '#D946EF',
    '#0EA5E9',
    '#65A30D',
  ];

  const fetchFolders = useCallback(async (presetAccessToken = null) => {
    try {
      const opts =
        presetAccessToken != null ? { accessToken: presetAccessToken } : {};
      const response = await apiFetch(config.endpoints.folders, opts);

      if (response.ok) {
        const data = await response.json();
        setFolders(data);
      }
    } catch (error) {
      if (error?.message !== AUTH_REQUIRED && error?.code !== AUTH_REQUIRED) {
        console.error('Error fetching folders:', error);
      }
    }
  }, []);

  const fetchConversations = useCallback(async (folderId = null, presetAccessToken = null) => {
    try {
      const opts =
        presetAccessToken != null ? { accessToken: presetAccessToken } : {};
      const url = folderId 
        ? `${config.endpoints.conversations}?folder_id=${folderId}`
        : config.endpoints.conversations;

      const response = await apiFetch(url, opts);

      if (response.ok) {
        const data = await response.json();
        setConversations(data);

        // If no folder is selected, this is the complete data set
        if (!folderId) {
          setAllConversations(data);

          // Stats are calculated directly in the UI now
        }
      }
    } catch (error) {
      if (error?.message !== AUTH_REQUIRED && error?.code !== AUTH_REQUIRED) {
        console.error('Error fetching conversations:', error);
      }
    }
  }, []);

  const fetchUsage = useCallback(async (presetAccessToken = null) => {
    try {
      const opts =
        presetAccessToken != null ? { accessToken: presetAccessToken } : {};
      const response = await apiFetch(config.endpoints.usage, opts);
      if (response.ok) {
        const data = await response.json();
        const next = normalizeUsageFromApi(data);
        if (next) setUsage(next);
        syncUsageQuotaFromApi(data);
      }
    } catch (error) {
      if (error?.message !== AUTH_REQUIRED && error?.code !== AUTH_REQUIRED) {
        console.error('Error fetching usage:', error);
      }
    }
  }, [syncUsageQuotaFromApi]);

  const fetchData = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    try {
      if (!silent) setLoading(true);
      const accessToken = await getSupabaseAccessToken();
      if (!accessToken) return;
      await Promise.all([
        fetchFolders(accessToken),
        fetchConversations(null, accessToken),
        fetchUsage(accessToken),
      ]);
      const uid = user?.id;
      if (supabase && uid) {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, full_name, role')
          .eq('id', uid)
          .maybeSingle();
        setUserProfile(data || null);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      if (error?.message !== AUTH_REQUIRED && error?.code !== AUTH_REQUIRED) {
        console.error('Error fetching data:', error);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fetchFolders, fetchConversations, fetchUsage, user?.id]);

  useEffect(() => {
    if (!user) return;

    let restored = false;
    try {
      const raw = sessionStorage.getItem(DASHBOARD_SESSION_CACHE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.userId === user.id) {
          if (Array.isArray(p.folders)) setFolders(p.folders);
          if (Array.isArray(p.conversations)) setConversations(p.conversations);
          if (Array.isArray(p.allConversations)) setAllConversations(p.allConversations);
          setLoading(false);
          restored = true;
        }
      }
    } catch {
      /* ignore corrupt cache */
    }

    analyticsService.trackPageView('dashboard', {
      user_has_folders: folders.length > 0,
      user_has_conversations: conversations.length > 0,
      is_admin: isAdminUser
    });

    fetchData({ silent: restored });

    return () => {
      analyticsService.track('dashboard_exit', {
        time_on_dashboard_ms: Date.now() - dashboardStartTime,
        folders_count: folders.length,
        conversations_count: conversations.length,
        search_performed: searchQuery.length > 0,
        selected_folder: selectedFolder?.name || 'all'
      });
    };
  }, [user, token, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.id || loading) return;
    try {
      sessionStorage.setItem(
        DASHBOARD_SESSION_CACHE_KEY,
        JSON.stringify({
          userId: user.id,
          folders,
          conversations,
          allConversations,
        }),
      );
    } catch {
      /* quota / private mode */
    }
  }, [loading, user?.id, folders, conversations, allConversations]);

  /** Usage is not session-cached — refetch when library size changes (e.g. return from research). */
  useEffect(() => {
    if (!user?.id || loading) return;
    let cancelled = false;
    (async () => {
      try {
        const accessToken = await getSupabaseAccessToken();
        if (!accessToken || cancelled) return;
        const response = await apiFetch(config.endpoints.usage, { accessToken });
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const next = normalizeUsageFromApi(data);
        if (next && !cancelled) setUsage(next);
        if (!cancelled) syncUsageQuotaFromApi(data);
      } catch (error) {
        if (error?.message !== AUTH_REQUIRED && error?.code !== AUTH_REQUIRED) {
          console.error('Error refreshing usage:', error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading, allConversations.length, syncUsageQuotaFromApi]);

  // Check if we should show the beta review modal when component loads
  useEffect(() => {
    if (shouldShowBetaReview()) {
      setShowBetaReviewModal(true);
    }
  }, []);

  // Development keyboard shortcut to test beta review modal
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    const handleKeyPress = (event) => {
      // Ctrl/Cmd + Shift + B = open Beta review modal
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'B') {
        event.preventDefault();
        setShowBetaReviewModal(true);
        console.log('🧪 Test: Beta Review Modal opened via keyboard shortcut');
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  const createFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const response = await apiFetch(`${config.API_BASE_URL}/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newFolderName,
          color: newFolderColor
        })
      });
      
      if (response.ok) {
        // Track folder creation
        analyticsService.track('folder_created', {
          folder_name: newFolderName,
          folder_color: newFolderColor,
          total_folders_before: folders.length
        });

        setNewFolderName('');
        setNewFolderColor('#3B82F6');
        setShowNewFolderModal(false);
        fetchFolders();
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      analyticsService.trackError('folder_create_failed', error.message, error.stack, {
        folder_name: newFolderName
      });
    }
  };

  const updateFolder = async () => {
    if (!editFolderName.trim() || !editFolderData) return;

    try {
      const response = await apiFetch(`${config.API_BASE_URL}/folders/${editFolderData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editFolderName,
          color: editFolderColor
        })
      });
      
      if (response.ok) {
        // Track successful folder update
        analyticsService.track('folder_updated', {
          folder_id: editFolderData.id,
          old_name: editFolderData.name,
          new_name: editFolderName,
          old_color: editFolderData.color,
          new_color: editFolderColor,
          name_changed: editFolderData.name !== editFolderName,
          color_changed: editFolderData.color !== editFolderColor
        });
        
        setEditFolderName('');
        setEditFolderColor('#3B82F6');
        setEditFolderData(null);
        setShowEditFolderModal(false);
        await fetchFolders();
        setNotification({
          type: 'success',
          message: 'Folder updated successfully'
        });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      console.error('Error updating folder:', error);
      setNotification({
        type: 'error',
        message: 'Failed to update folder'
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const selectFolder = (folder) => {
    setSelectedFolder(folder);
    
    // Track folder selection
    analyticsService.track('folder_selected', {
      folder_name: folder?.name || 'all_research',
      folder_id: folder?.id || null,
      previous_folder: selectedFolder?.name || 'all_research',
      conversations_in_folder: folder?.conversation_count || allConversations.length
    });
    
    if (folder === null) {
      // When selecting "All Research", show all conversations
      setConversations(allConversations);
    } else {
      fetchConversations(folder.id);
    }
  };

  const moveConversationToFolder = async (conversationId, folderId) => {
    const conversation = conversations.find(c => c.id === conversationId);
    const targetFolder = folders.find(f => f.id === folderId);
    
    try {
      const response = await apiFetch(`${config.API_BASE_URL}/conversations/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          folder_id: folderId
        })
      });

      if (response.ok) {
        // Track conversation move
        analyticsService.track('conversation_moved', {
          conversation_id: conversationId,
          conversation_title: conversation?.title,
          from_folder: conversation?.folder_id || 'all_research',
          to_folder: folderId || 'all_research',
          to_folder_name: targetFolder?.name || 'All Research',
          move_method: 'drag_drop'
        });

        // Refresh data to reflect the move
        await fetchData({ silent: true });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error moving conversation:', error);
      analyticsService.trackError('conversation_move_failed', error.message, error.stack, {
        conversation_id: conversationId,
        target_folder_id: folderId
      });
      return false;
    }
  };


  const handleDeleteConversation = (conversation) => {
    // Track delete initiation
    analyticsService.track('delete_conversation_initiated', {
      conversation_id: conversation.id,
      conversation_title: conversation.title,
      conversation_folder: conversation.folder_id || 'all_research'
    });
    
    setItemToDelete(conversation);
    setDeleteType('conversation');
    setShowDeleteModal(true);
  };

  const handleDeleteFolder = (folder) => {
    analyticsService.track('delete_folder_initiated', {
      folder_id: folder.id,
      folder_name: folder.name,
      conversation_count: folder.conversation_count ?? 0,
    });
    setItemToDelete(folder);
    setDeleteType('folder');
    setShowDeleteModal(true);
  };


  const confirmDelete = async (deleteAllResearch = false) => {
    if (!itemToDelete) return;

    try {
      if (deleteType === 'conversation') {
        const response = await apiFetch(`${config.API_BASE_URL}/conversations/${itemToDelete.id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          const data = await response.json();
          
          // Track successful conversation deletion
          analyticsService.track('conversation_deleted', {
            conversation_id: itemToDelete.id,
            conversation_title: itemToDelete.title,
            folder_name: selectedFolder?.name || 'all_research'
          });
          
          setNotification({
            type: 'success',
            message: data.message
          });
          await fetchData({ silent: true });
        } else {
          throw new Error('Failed to delete research');
        }
      } else if (deleteType === 'folder') {
        const response = await apiFetch(`${config.API_BASE_URL}/folders/${itemToDelete.id}?delete_conversations=${deleteAllResearch}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          const data = await response.json();
          
          // Track successful folder deletion
          analyticsService.track('folder_deleted', {
            folder_id: itemToDelete.id,
            folder_name: itemToDelete.name,
            conversations_count: itemToDelete.conversation_count,
            delete_conversations: deleteAllResearch
          });
          
          setNotification({
            type: 'success',
            message: data.message
          });
          await fetchData({ silent: true });
          // If we deleted the currently selected folder, reset to "All Research"
          if (selectedFolder && selectedFolder.id === itemToDelete.id) {
            setSelectedFolder(null);
          }
        } else {
          throw new Error('Failed to delete folder');
        }
      }
    } catch (error) {
      console.error('Error deleting:', error);
      setNotification({
        type: 'error',
        message: 'Failed to delete. Please try again.'
      });
    } finally {
      setShowDeleteModal(false);
      setItemToDelete(null);
      setDeleteType(null);
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);
    
    // Track drag operation start
    const conversation = conversations.find(
      (c) => c.id === active.id || String(c.id) === String(active.id),
    );
    analyticsService.track('conversation_drag_started', {
      conversation_id: active.id,
      conversation_title: conversation?.title,
      current_folder: conversation?.folder_id || 'all_research'
    });
  };

  const handleDragOver = () => {
    // Simplified - no special over handling needed for new design
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    setActiveId(null);

    if (!over) return;

    const draggedConversationId = active.id;
    const droppedOnId = over.id;

    const targetFolder =
      folders.find((f) => f.id === droppedOnId || String(f.id) === String(droppedOnId)) ?? null;
    const isDroppedOnAllResearch =
      droppedOnId === 'all-research' || String(droppedOnId) === 'all-research';

    if (!(targetFolder || isDroppedOnAllResearch)) return;

    const targetFolderId = targetFolder ? targetFolder.id : null;

    const conversation = conversations.find(
      (c) =>
        c.id === draggedConversationId ||
        String(c.id) === String(draggedConversationId),
    );

    if (conversation && conversation.folder_id !== targetFolderId) {
      const success = await moveConversationToFolder(draggedConversationId, targetFolderId);

      if (success) {
        setNotification({
          type: 'success',
          message: `Moved "${conversation.title}" to ${targetFolder?.name || 'All Research'}`,
        });
        setTimeout(() => setNotification(null), 3000);
      } else {
        setNotification({
          type: 'error',
          message: 'Failed to move conversation',
        });
        setTimeout(() => setNotification(null), 3000);
      }
    }
  };

  const startNewResearch = () => {
    if (researchCreationBlocked) {
      setShowQuotaLimitModal(true);
      return;
    }
    const params = new URLSearchParams();
    if (selectedFolder) {
      params.set('folder_id', selectedFolder.id);
    }
    
    // Track new research initiation
    analyticsService.trackButtonClick('start_new_research', 'dashboard', {
      selected_folder: selectedFolder?.name || 'all_research',
      total_conversations: conversations.length,
      usage_status: {
        reports_used: usage.reports_used,
        reports_limit: usage.reports_limit,
        reports_quota_locked: usage.reports_quota_locked,
        is_admin: isAdminUser,
      },
    });
    
    navigate(`/research?${params.toString()}`);
  };

  const openConversation = (conversation) => {
    // Track conversation open from dashboard
    analyticsService.trackContentInteraction('conversation', 'opened_from_dashboard', {
      conversation_id: conversation.id,
      conversation_title: conversation.title,
      conversation_created: conversation.created_at,
      folder_name: selectedFolder?.name || 'all_research',
      open_method: 'card_click'
    });
    
    navigate(`/research?convo_id=${conversation.id}`);
  };

  const openExportModal = useCallback(() => {
    const sorted = [...allConversations].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );
    setExportSelectedId(sorted[0]?.id ?? null);
    setShowExportModal(true);
  }, [allConversations]);

  const runDashboardExport = useCallback(async () => {
    if (exportSelectedId == null) return;
    setExportBusy(true);
    try {
      const response = await apiFetch(config.endpoints.messages(exportSelectedId));
      if (!response.ok) throw new Error('Failed to load report');
      const payload = await response.json();
      // Backend now returns { messages, conversation_type }; tolerate the
      // older array-only shape during deploy transitions.
      const messages = Array.isArray(payload) ? payload : (payload?.messages || []);
      const conv = allConversations.find(
        (c) => c.id === exportSelectedId || String(c.id) === String(exportSelectedId),
      );
      const title = conv?.title || 'Research Report';
      const ok = exportResearchToPDF({
        messages,
        conversationTitle: title,
        conversationId: exportSelectedId,
      });
      if (!ok) {
        alert('No assistant report content to export for this conversation.');
      } else {
        setShowExportModal(false);
      }
    } catch (err) {
      console.error(err);
      alert('Could not load this report. Please try again.');
    } finally {
      setExportBusy(false);
    }
  }, [exportSelectedId, allConversations]);

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const draggedConversation =
    activeId == null
      ? null
      : conversations.find(
          (c) => c.id === activeId || String(c.id) === String(activeId),
        ) ||
        allConversations.find(
          (c) => c.id === activeId || String(c.id) === String(activeId),
        );
  const draggedFolderMeta = folderMetaForConversation(draggedConversation, folders);

  if (loading) {
    return (
      <div className="route" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <Header />
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '240px 1fr',
          gridTemplateRows: '1fr',
          minHeight: 0,
        }}>
        {/* SIDEBAR */}
        <aside style={{
          borderRight: '1px solid var(--line)', padding: '22px 14px',
          display: 'flex', flexDirection: 'column', gap: 18,
          height: '100%',
          minHeight: 0,
        }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--mut2)', letterSpacing: '.18em', padding: '0 6px 8px' }}>FOLDERS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 8px', borderRadius: 6, border: 'none',
                background: 'var(--card)', color: 'var(--fg)', cursor: 'default',
                fontSize: 13, fontFamily: 'Geist, sans-serif'
              }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--mut2)' }}/>
                <div style={{ width: 80, height: 12, background: 'var(--line)', borderRadius: 4, animation: 'pulse 2s infinite' }}></div>
                <span style={{ width: 20, height: 10, background: 'var(--line)', borderRadius: 4, animation: 'pulse 2s infinite 0.2s' }}></span>
              </button>
              
              {/* Skeleton folders */}
              {[1, 2, 3].map((i) => (
                <button key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 8px', borderRadius: 6, border: 'none',
                  background: 'transparent', color: 'var(--fg)', cursor: 'default',
                  fontSize: 13, fontFamily: 'Geist, sans-serif'
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 4, 
                    background: i === 1 ? 'var(--violet)' : i === 2 ? 'var(--cyan)' : 'var(--hot)'
                  }}/>
                  <div style={{ width: 90 + i * 10, height: 12, background: 'var(--line)', borderRadius: 4, animation: `pulse 2s infinite ${i * 0.2}s` }}></div>
                  <span style={{ width: 15, height: 10, background: 'var(--line)', borderRadius: 4, animation: `pulse 2s infinite ${i * 0.2 + 0.3}s` }}></span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--mut2)', letterSpacing: '.18em', padding: '0 6px 8px' }}>QUICK</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 8px', borderRadius: 6, border: 'none',
                background: 'transparent', color: 'var(--mut)', cursor: 'default',
                textAlign: 'left', fontSize: 13, fontFamily: 'Geist, sans-serif',
              }}>
                <Icon.Download/>
                <div style={{ width: 72, height: 12, background: 'var(--line)', borderRadius: 4, animation: 'pulse 2s infinite' }}></div>
              </button>
            </div>
          </div>

          <DashboardTipCard style={{ marginTop: 'auto', marginBottom: '0dvh' }} />
        </aside>

        {/* MAIN */}
        <main style={{ padding: '24px 32px', minHeight: 0, overflow: 'auto' }}>
          {/* page heading */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ width: 120, height: 10, background: 'var(--line)', borderRadius: 4, marginBottom: 8, animation: 'pulse 2s infinite' }}></div>
              <div style={{ width: 350, height: 48, background: 'var(--line)', borderRadius: 6, marginBottom: 12, animation: 'pulse 2s infinite 0.2s' }}></div>
              <div style={{ width: 250, height: 14, background: 'var(--line)', borderRadius: 4, animation: 'pulse 2s infinite 0.4s' }}></div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--card)', border: '1px solid var(--line-strong)',
                minWidth: 280,
              }}>
                <Icon.Search />
                <div style={{ flex: 1, height: 14, background: 'var(--line)', borderRadius: 4, animation: 'pulse 2s infinite' }}></div>
                <span className="mono" style={{ fontSize: 10, color: 'var(--mut2)', padding: '2px 6px', border: '1px solid var(--line)', borderRadius: 4 }}>⌘K</span>
              </div>
            </div>
          </div>

          {/* big stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card" style={{ padding: 18, position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: 4, height: '100%',
                  background: i === 1 ? 'var(--violet)' : i === 2 ? 'var(--cyan)' : i === 3 ? 'var(--hot)' : 'var(--sun)',
                }}/>
                <div style={{ width: 60 + i * 10, height: 32, background: 'var(--line)', borderRadius: 6, marginBottom: 8, animation: `pulse 2s infinite ${i * 0.1}s` }}></div>
                <div style={{ width: 80 + i * 5, height: 10, background: 'var(--line)', borderRadius: 4, animation: `pulse 2s infinite ${i * 0.1 + 0.3}s` }}></div>
              </div>
            ))}
          </div>

          {/* Reports */}
          <div>
            <div style={{ 
              display: 'flex', alignItems: 'center', marginBottom: 16,
              padding: '8px 0', borderBottom: '1px solid var(--line)',
            }}>
              <div style={{ width: 100, height: 10, background: 'var(--line)', borderRadius: 4, animation: 'pulse 2s infinite' }}></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Skeleton report cards */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="card" style={{
                  padding: '12px 14px', display: 'grid', gridTemplateColumns: '20px 20px 1fr auto auto',
                  gap: 10, alignItems: 'center', background: 'var(--card)', border: '1px solid var(--line)',
                }}>
                  <div style={{ width: 12, height: 18, background: 'var(--line)', borderRadius: 4, opacity: 0.7 }}/>
                  <div style={{
                    width: 22, height: 28, borderRadius: 3,
                    background: i === 1 ? 'var(--violet)' : i === 2 ? 'var(--cyan)' : 'var(--hot)', 
                    opacity: .9
                  }}/>
                  <div>
                    <div style={{ width: 200 + i * 20, height: 18, background: 'var(--line)', borderRadius: 4, marginBottom: 6, animation: `pulse 2s infinite ${i * 0.1}s` }}></div>
                    <div style={{ width: 120 + i * 10, height: 10, background: 'var(--line)', borderRadius: 4, animation: `pulse 2s infinite ${i * 0.1 + 0.2}s` }}></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--violet)' }}/>
                    <div style={{ width: 40, height: 10, background: 'var(--line)', borderRadius: 4, animation: `pulse 2s infinite ${i * 0.1 + 0.4}s` }}></div>
                  </div>
                  <Icon.Arrow />
                </div>
              ))}
            </div>
          </div>
        </main>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="route" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <Header />
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '240px 1fr',
          gridTemplateRows: '1fr',
          minHeight: 0,
        }}>
        {/* SIDEBAR */}
        <aside style={{
          borderRight: '1px solid var(--line)', padding: '22px 14px',
          display: 'flex', flexDirection: 'column', gap: 18,
          height: '100%',
          minHeight: 0,
        }}>
          <button 
            className="btn btn-new-research" 
            style={{ 
              justifyContent: 'center',
              opacity: researchCreationBlocked ? 0.6 : 1
            }} 
            onClick={startNewResearch}
          >
            <Icon.Plus /> New research
          </button>

          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--mut2)', letterSpacing: '.18em', padding: '0 6px 8px' }}>FOLDERS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <DroppableFolderTarget dropId="all-research">
              <button 
                type="button"
                onClick={() => selectFolder(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 8px', borderRadius: 6, border: 'none',
                  background: selectedFolder === null ? 'var(--card)' : 'transparent',
                  color: 'var(--fg)', cursor: 'pointer', textAlign: 'left',
                  fontSize: 13, fontFamily: 'Geist, sans-serif',
                  width: '100%',
                }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 4, background: 'var(--mut2)',
                  flexShrink: 0,
                }}/>
                <span style={{ flex: 1 }}>All research</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--mut2)' }}>{allConversations.length}</span>
              </button>
              </DroppableFolderTarget>
              
              {/* User folders */}
              {folders.map(f => (
              <DroppableFolderTarget key={f.id} dropId={f.id}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    borderRadius: 8,
                    background: selectedFolder?.id === f.id ? 'var(--card)' : 'transparent',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => selectFolder(f)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 6px 8px 10px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--fg)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 13,
                      fontFamily: 'Geist, sans-serif',
                      minWidth: 0,
                    }}
                  >
                    <span style={{
                      width: 14, height: 14, borderRadius: 4, background: f.color,
                      flexShrink: 0,
                    }}/>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--mut2)', flexShrink: 0 }}>{f.conversation_count}</span>
                  </button>
                  <button
                    type="button"
                    className="action-button"
                    aria-label={`Delete folder ${f.name}`}
                    title="Delete folder"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(f);
                    }}
                    style={{
                      flexShrink: 0,
                      padding: 6,
                      margin: 0,
                      marginRight: 4,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--mut2)',
                      cursor: 'pointer',
                      borderRadius: 4,
                    }}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </DroppableFolderTarget>
              ))}
              
              <button 
                onClick={() => setShowNewFolderModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, border: '1px dashed var(--line-strong)',
                  background: 'transparent', color: 'var(--mut)', cursor: 'pointer',
                  fontSize: 13, marginTop: 6,
                }}>
                <Icon.Plus /> New folder
              </button>
            </div>
          </div>

          <div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--mut2)', letterSpacing: '.18em', padding: '0 6px 8px' }}>QUICK</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <SideLink icon={<Icon.Download/>} label="Export" onClick={openExportModal} />
              <SideLink 
                icon={<span style={{color: 'var(--violet)'}}></span>} 
                label="Give Feedback" 
                onClick={() => setShowBetaReviewModal(true)} 
              />
            </div>
          </div>

          <DashboardTipCard style={{ marginTop: 'auto', marginBottom: '5dvh' }} />
        </aside>

        {/* MAIN */}
        <main style={{ padding: '24px 32px', minHeight: 0, overflow: 'auto' }}>
          {/* page heading */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--mut2)', letterSpacing: '.18em' }}>YOUR LIBRARY</div>
              <h1 className="serif" style={{
                fontSize: 'clamp(32px, 4vw, 48px)', lineHeight: 1, margin: '6px 0 0', letterSpacing: '-.02em',
              }}>
                {getTimeOfDayGreeting()},{' '}
                <span style={{ fontStyle: 'italic' }}>
                  <span className="marker-half" style={{ color: 'var(--fg)' }}>
                    {getUserFirstName(userProfile, user)}
                  </span>
                </span>
                .
              </h1>
              <p style={{ margin: '8px 0 0', color: 'var(--mut)', fontSize: 13, fontStyle: 'italic' }}>
                "{getResearcherQuote()}"
              </p>
              {(showQuotaCapSubtitle || showAdminUnlimitedSubtitle) && (
              <p style={{ margin: '8px 0 0', color: 'var(--mut)', fontSize: 14 }}>
                {showQuotaCapSubtitle ? (
                  <>
                    <span className="marker-half" style={{ color: 'var(--fg)' }}>
                      {quotaHeadingLimit} {reportsNoun(quotaHeadingLimit)}
                    </span>{' '}
                    deep — <span className="marker-half" style={{ color: 'var(--fg)' }}>beta cap</span>. <span className="marker-half" style={{ color: 'var(--fg)' }}>Deletes</span> won&apos;t refill.
                  </>
                ) : (
                  <>No monthly report cap on your account.</>
                )}
              </p>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 14,
                minWidth: 280,
              }}
            >
              {showUserRoleReportLimitHeading && <DashboardBetaSearchBlurb />}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--card)', border: '1px solid var(--line-strong)',
                minWidth: 280,
              }}>
                <Icon.Search />
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setSearchQuery(newValue);
                    
                    // Track search behavior on dashboard
                    if (newValue.length > 2) {
                      analyticsService.track('dashboard_search', {
                        query: newValue,
                        query_length: newValue.length,
                        selected_folder: selectedFolder?.name || 'all_research',
                        total_conversations: conversations.length
                      });
                    }
                  }}
                  placeholder="Search your library…"
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--fg)', fontFamily: 'Geist, sans-serif', fontSize: 14 }}
                />
              </div>
            </div>
          </div>

          {/* big stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
            <BigStat n={allConversations.length.toString()} l="Total reports" tint="var(--violet)" />
            <BigStat n={String(usage.sources_cited_total ?? 0)} l="Sources cited" tint="var(--cyan)"/>
            <BigStat n={allConversations.filter(conv => {
              const oneWeekAgo = new Date();
              oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
              return new Date(conv.created_at) > oneWeekAgo;
            }).length.toString()} l="Reports this week" tint="var(--hot)"/>
            <BigStat n={folders.length.toString()} l="Active folders" tint="var(--sun)"/>
          </div>

          {/* Reports */}
          <div>
            <FrameDivider label={`${filteredConversations.length} reports`} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredConversations.map((r, i) => (
                <DraggableReportRow
                  key={r.id}
                  r={r}
                  folders={folders}
                  accentTint={REPORT_ROW_ACCENT_TINTS[i % REPORT_ROW_ACCENT_TINTS.length]}
                  onOpen={openConversation}
                  onDelete={handleDeleteConversation}
                />
              ))}
              {!filteredConversations.length && (
                <div
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    background: 'transparent',
                    borderRadius: 12,
                  }}
                >
                  <div className="serif" style={{ fontSize: 22, fontStyle: 'italic' }}>Nothing here yet.</div>
                  <p style={{ color: 'var(--mut)', marginTop: 6 }}>
                    {selectedFolder 
                      ? `Try a different folder or search term.`
                      : 'Start your first research project to see it here.'
                    }
                  </p>
                  <button
                    type="button"
                    className="btn btn-new-research"
                    onClick={startNewResearch}
                    style={{
                      marginTop: 20,
                      borderRadius: 9999,
                      opacity: researchCreationBlocked ? 0.6 : 1,
                    }}
                  >
                    <Icon.Plus /> New research
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
        </div>
      </div>


      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ padding: 24, width: '100%', maxWidth: '28rem', margin: '0 1rem' }}>
            <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)', marginBottom: 16 }}>Create New Folder</h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mut)', marginBottom: 8 }}>Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name..."
                style={{ 
                  width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8,
                  background: 'var(--card)', color: 'var(--fg)', fontFamily: 'Geist, sans-serif', fontSize: 14,
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mut)', marginBottom: 8 }}>Color</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewFolderColor(color)}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', border: newFolderColor === color ? '2px solid var(--fg)' : '2px solid var(--line)',
                      backgroundColor: color, cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                className="btn btn-primary"
                style={{ flex: 1, opacity: !newFolderName.trim() ? 0.5 : 1 }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Folder Modal */}
      {showEditFolderModal && editFolderData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ padding: 24, width: '100%', maxWidth: '28rem', margin: '0 1rem' }}>
            <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)', marginBottom: 16 }}>Edit Folder</h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mut)', marginBottom: 8 }}>Folder Name</label>
              <input
                type="text"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                placeholder="Enter folder name..."
                style={{ 
                  width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8,
                  background: 'var(--card)', color: 'var(--fg)', fontFamily: 'Geist, sans-serif', fontSize: 14,
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--mut)', marginBottom: 8 }}>Color</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setEditFolderColor(color)}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', border: editFolderColor === color ? '2px solid var(--fg)' : '2px solid var(--line)',
                      backgroundColor: color, cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => {
                  setShowEditFolderModal(false);
                  setEditFolderData(null);
                  setEditFolderName('');
                  setEditFolderColor('#3B82F6');
                }}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={updateFolder}
                disabled={!editFolderName.trim()}
                className="btn btn-primary"
                style={{ flex: 1, opacity: !editFolderName.trim() ? 0.5 : 1 }}
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export report modal */}
      {showExportModal && (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target !== e.currentTarget || exportBusy) return;
            setShowExportModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            className="card"
            role="dialog"
            aria-labelledby="dashboard-export-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: 24,
              width: '100%',
              maxWidth: '32rem',
              margin: '0 1rem',
              maxHeight: 'min(640px, 90vh)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h3 id="dashboard-export-title" className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
              Export report
            </h3>
            <p style={{ color: 'var(--mut)', marginBottom: 16, fontSize: 14, lineHeight: 1.45 }}>
              Select a report, then export PDF—the same print flow as on the research page.
            </p>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 120,
                maxHeight: 'min(360px, 50vh)',
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: 8,
              }}
            >
              {allConversations.length === 0 ? (
                <p style={{ padding: 16, color: 'var(--mut)', fontSize: 14 }}>
                  No reports yet. Start research to create one.
                </p>
              ) : (
                [...allConversations]
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((c) => {
                    const selected =
                      exportSelectedId != null &&
                      (c.id === exportSelectedId || String(c.id) === String(exportSelectedId));
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setExportSelectedId(c.id)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: 8,
                          marginBottom: 6,
                          border: selected ? '2px solid var(--violet)' : '1px solid var(--line)',
                          background: selected ? 'var(--card)' : 'transparent',
                          cursor: 'pointer',
                          fontFamily: 'Geist, sans-serif',
                          color: 'var(--fg)',
                        }}
                      >
                        <div className="serif" style={{ fontSize: 15, lineHeight: 1.3 }}>{c.title}</div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--mut2)', marginTop: 4, letterSpacing: '.04em' }}>
                          {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </button>
                    );
                  })
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => !exportBusy && setShowExportModal(false)}
                className="btn btn-ghost"
                style={{ flex: 1 }}
                disabled={exportBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runDashboardExport}
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={exportBusy || exportSelectedId == null || allConversations.length === 0}
              >
                {exportBusy ? 'Loading…' : 'Export PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && itemToDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ padding: 24, width: '100%', maxWidth: '28rem', margin: '0 1rem' }}>
            {deleteType === 'conversation' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <svg width="24" height="24" fill="none" stroke="var(--hot)" viewBox="0 0 24 24" style={{ marginRight: 12 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>Delete Research</h3>
                </div>
                <p style={{ color: 'var(--mut)', marginBottom: 24, lineHeight: 1.5 }}>
                  Are you sure you want to delete <strong style={{ color: 'var(--fg)' }}>"{itemToDelete.title}"</strong>? This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => confirmDelete()}
                    className="btn"
                    style={{ flex: 1, background: 'var(--hot)', color: 'white' }}
                  >
                    Delete Research
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <svg width="24" height="24" fill="none" stroke="var(--hot)" viewBox="0 0 24 24" style={{ marginRight: 12 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>Delete Folder</h3>
                </div>
                <p style={{ color: 'var(--mut)', marginBottom: 16, lineHeight: 1.5 }}>
                  What would you like to do with the <strong style={{ color: 'var(--fg)' }}>{itemToDelete.conversation_count ?? 0} research items</strong> in the <strong style={{ color: 'var(--fg)' }}>"{itemToDelete.name}"</strong> folder?
                </p>
                <div className="card" style={{ padding: 16, marginBottom: 24, background: 'var(--bg-2)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <input
                        type="radio"
                        name="deleteOption"
                        value="move"
                        defaultChecked
                        style={{ marginTop: 4, marginRight: 12 }}
                      />
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--fg)' }}>Move to "All Research"</div>
                        <div style={{ fontSize: 13, color: 'var(--mut)' }}>Keep all research items but move them out of this folder</div>
                      </div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <input
                        type="radio"
                        name="deleteOption"
                        value="delete"
                        style={{ marginTop: 4, marginRight: 12 }}
                      />
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--hot)' }}>Delete everything</div>
                        <div style={{ fontSize: 13, color: 'var(--hot)' }}>Permanently delete the folder and all research items inside</div>
                      </div>
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="btn btn-ghost"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const deleteAll = document.querySelector('input[name="deleteOption"]:checked').value === 'delete';
                      confirmDelete(deleteAll);
                    }}
                    className="btn"
                    style={{ flex: 1, background: 'var(--hot)', color: 'white' }}
                  >
                    Delete Folder
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="card" style={{
          position: 'fixed', top: 16, right: 16, zIndex: 50, padding: 16,
          maxWidth: '20rem', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          background: notification.type === 'success' ? 'var(--card)' : 'var(--card)',
          border: notification.type === 'success' ? '1px solid var(--cyan)' : '1px solid var(--hot)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {notification.type === 'success' ? (
              <svg width="20" height="20" fill="none" stroke="var(--cyan)" viewBox="0 0 24 24" style={{ marginRight: 12, flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg width="20" height="20" fill="none" stroke="var(--hot)" viewBox="0 0 24 24" style={{ marginRight: 12, flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>{notification.message}</span>
          </div>
        </div>
      )}
      
      <DragOverlay>
        {activeId ? (
          <div
            className="card"
            style={{
              padding: '12px 14px',
              opacity: 0.92,
              boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
              display: 'grid',
              gridTemplateColumns: '28px 1fr',
              gap: 12,
              alignItems: 'center',
              minWidth: 280,
            }}
          >
            <div
              style={{
                width: 22,
                height: 28,
                borderRadius: 3,
                background: draggedFolderMeta.color,
                opacity: 0.9,
                boxShadow: `0 6px 14px -8px ${draggedFolderMeta.color}`,
              }}
            />
            <span className="serif" style={{ fontWeight: 500, fontSize: 16, color: 'var(--fg)', lineHeight: 1.2 }}>
              {draggedConversation?.title || 'Research report'}
            </span>
          </div>
        ) : null}
      </DragOverlay>

      {/* Beta Review Modal */}
      <BetaReviewModal
        isOpen={showBetaReviewModal}
        onClose={() => {
          setShowBetaReviewModal(false);
          clearBetaReviewFlag();
        }}
        onSubmit={async (reviewData) => {
          await handleBetaReviewSubmit(reviewData);
          setShowBetaReviewModal(false);
        }}
      />

      {/* Quota Limit Modal */}
      {showQuotaLimitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div 
            className="card" 
            style={{ 
              padding: '32px 36px', 
              width: '100%', 
              maxWidth: '480px', 
              margin: '0 1rem',
              textAlign: 'center'
            }}
          >
            {/* Header */}
            <div className="mono" style={{ fontSize: 10, color: 'var(--mut2)', letterSpacing: '.18em', marginBottom: 20 }}>
              BETA LIMIT REACHED
            </div>
            
            <h3 
              className="serif" 
              style={{ 
                fontSize: 'clamp(24px, 3vw, 32px)',
                fontWeight: 400, 
                color: 'var(--fg)', 
                marginBottom: 16, 
                lineHeight: 1.2,
                letterSpacing: '-.015em'
              }}
            >
              Thank you for using Deep<span style={{ fontStyle: 'italic', color: 'var(--sun)' }}>Research!</span>
            </h3>
            
            <p style={{ 
              color: 'var(--mut)', 
              marginBottom: 28, 
              fontSize: 15, 
              lineHeight: 1.55,
              fontFamily: 'Geist, sans-serif'
            }}>
              You've reached your <span className="marker-half" style={{ color: 'var(--fg)' }}>beta limit</span> of {usage.reports_limit || 5} reports. 
              We'll see you in the next trial! You can still explore your existing reports and use follow-up questions.
            </p>

            <button
              onClick={() => setShowQuotaLimitModal(false)}
              className="btn"
              style={{
                background: 'var(--violet)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: 8,
                fontFamily: 'Geist, sans-serif',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(124, 92, 255, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 8px 24px rgba(124, 92, 255, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 16px rgba(124, 92, 255, 0.3)';
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </DndContext>
  );
};

export default Dashboard; 