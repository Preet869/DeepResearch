import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Draggable Research Card Component
const DraggableResearchCard = ({ conversation, onOpen, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: conversation.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleCardClick = (e) => {
    // Only open if not clicking on action buttons
    if (!e.target.closest('.action-button')) {
      onOpen(conversation);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(conversation);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleCardClick}
      className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group ${
        isDragging ? 'opacity-50 cursor-grabbing' : ''
      }`}
    >
            <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 flex-1 pr-2">
          {conversation.title}
        </h3>
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={handleDelete}
            className="action-button p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
            title="Delete research"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <div className="relative group/drag">
            <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group/drag:hover:text-blue-700 transition-colors cursor-grab" fill="currentColor" viewBox="0 0 24 24" title="Drag to move to folder">
              <circle cx="9" cy="7" r="1.5"/>
              <circle cx="9" cy="12" r="1.5"/>
              <circle cx="9" cy="17" r="1.5"/>
              <circle cx="15" cy="7" r="1.5"/>
              <circle cx="15" cy="12" r="1.5"/>
              <circle cx="15" cy="17" r="1.5"/>
            </svg>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group/drag:hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              Drag to folder
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      
      <div className="flex items-center text-sm text-gray-500 mb-4">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v16a2 2 0 002 2z" />
        </svg>
        {new Date(conversation.created_at).toLocaleDateString()}
      </div>

      <div className="h-20 bg-gray-50 rounded-lg flex items-center justify-center">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2V7a2 2 0 012-2h2a2 2 0 002 2v2a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 00-2 2h-2a2 2 0 00-2 2v6a2 2 0 01-2 2H9z" />
        </svg>
      </div>
    </div>
  );
};

// Droppable Folder Component
const DroppableFolderButton = ({ folder, isSelected, onSelect, isOver, id, isDraggingFolder = false }) => {
  const { setNodeRef } = useSortable({ id: id });
  
  const baseClasses = `w-full text-left p-3 rounded-lg transition-colors ${
    isSelected
      ? 'bg-blue-50 text-blue-700 border border-blue-200'
      : 'hover:bg-gray-50 text-gray-700'
  }`;
  
  const overClasses = isOver ? 'bg-green-50 border-green-300 border-2 shadow-md' : '';
  const dropHintClasses = isOver ? 'text-green-700' : '';
  
  return (
    <button
      ref={setNodeRef}
      onClick={() => onSelect(folder)}
      className={`${baseClasses} ${overClasses}`}
    >
      <div className="flex items-center">
        <div
          className="w-4 h-4 rounded mr-3"
          style={{ backgroundColor: folder?.color || '#6B7280' }}
        ></div>
        <span className={`font-medium ${dropHintClasses}`}>{folder?.name || 'All Research'}</span>
        {isOver && !isDraggingFolder && (
          <svg className="w-4 h-4 ml-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        )}
      </div>
      <p className={`text-sm ml-7 ${isOver && !isDraggingFolder ? 'text-green-600' : 'text-gray-500'}`}>
        {isOver && !isDraggingFolder ? 'Drop here to move' : `${folder?.conversation_count || 0} reports`}
      </p>
    </button>
  );
};

// Draggable & Droppable Folder Component
const DraggableFolderButton = ({ folder, isSelected, onSelect, isOverForDrop, isOverForReorder, isDragging, isDraggingFolder, onDelete, onEdit }) => {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
  } = useSortable({ id: `folder-${folder.id}` });

  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id: folder.id,
  });

  const setNodeRef = (node) => {
    setSortableNodeRef(node);
    setDroppableNodeRef(node);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  const baseClasses = `w-full text-left p-3 rounded-lg transition-colors ${
    isSelected
      ? 'bg-blue-50 text-blue-700 border border-blue-200'
      : 'hover:bg-gray-50 text-gray-700'
  }`;
  
  // Different visual feedback for different drop types
  let overClasses = '';
  let statusMessage = `${folder.conversation_count} reports`;
  
  if (isOverForReorder && isDraggingFolder) {
    overClasses = 'bg-blue-100 border-blue-300 border-2 shadow-md';
    statusMessage = 'Drop here to reorder';
  } else if (isOverForDrop && !isDraggingFolder) {
    overClasses = 'bg-green-50 border-green-300 border-2 shadow-md';
    statusMessage = 'Drop here to move';
  }
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${baseClasses} ${overClasses} cursor-pointer group/folder`}
      {...attributes}
    >
      <div className="flex items-center justify-between" onClick={() => onSelect(folder)}>
        <div className="flex items-center flex-1">
          <div
            className="w-4 h-4 rounded mr-3"
            style={{ backgroundColor: folder.color }}
          ></div>
          <span className={`font-medium ${isOverForDrop && !isDraggingFolder ? 'text-green-700' : ''}`}>
            {folder.name}
          </span>
          {isOverForDrop && !isDraggingFolder && (
            <svg className="w-4 h-4 ml-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(folder);
            }}
            className="action-button p-1 opacity-0 group-hover/folder:opacity-100 transition-opacity text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
            title="Edit folder"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(folder);
            }}
            className="action-button p-1 opacity-0 group-hover/folder:opacity-100 transition-opacity text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
            title="Delete folder"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <div
            {...listeners}
            className="p-1 opacity-0 group-hover/folder:opacity-100 transition-opacity cursor-grab hover:bg-gray-200 rounded"
            onClick={(e) => e.stopPropagation()}
            title="Drag to reorder"
          >
            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="7" r="1"/>
              <circle cx="9" cy="12" r="1"/>
              <circle cx="9" cy="17" r="1"/>
              <circle cx="15" cy="7" r="1"/>
              <circle cx="15" cy="12" r="1"/>
              <circle cx="15" cy="17" r="1"/>
            </svg>
          </div>
        </div>
      </div>
      <p className={`text-sm ml-7 ${
        isOverForDrop && !isDraggingFolder ? 'text-green-600' : 
        isOverForReorder && isDraggingFolder ? 'text-blue-600' : 
        'text-gray-500'
      }`}>
        {statusMessage}
      </p>
    </div>
  );
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
  const [stats, setStats] = useState({ totalReports: 0, thisWeek: 0, totalFolders: 0 });
  const [allConversations, setAllConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isDraggingFolder, setIsDraggingFolder] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // 'conversation' or 'folder'
  const [showEditFolderModal, setShowEditFolderModal] = useState(false);
  const [editFolderData, setEditFolderData] = useState(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderColor, setEditFolderColor] = useState('#3B82F6');

  const { token } = useAuth();
  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
    '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'
  ];

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchFolders(), fetchConversations()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/folders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setFolders(data);
        setStats(prev => ({ ...prev, totalFolders: data.length }));
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  };

  const fetchConversations = async (folderId = null) => {
    try {
      const url = folderId 
        ? `http://127.0.0.1:8000/conversations?folder_id=${folderId}`
        : 'http://127.0.0.1:8000/conversations';
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        
        // If no folder is selected, this is the complete data set
        if (!folderId) {
          setAllConversations(data);
          
          // Calculate stats for all conversations
          const totalReports = data.length;
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          const thisWeek = data.filter(conv => 
            new Date(conv.created_at) > oneWeekAgo
          ).length;
          
          setStats(prev => ({ ...prev, totalReports, thisWeek }));
        }
        // If a folder is selected, we only update the current view but keep total stats
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      const response = await fetch('http://127.0.0.1:8000/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newFolderName,
          color: newFolderColor
        })
      });
      
      if (response.ok) {
        setNewFolderName('');
        setNewFolderColor('#3B82F6');
        setShowNewFolderModal(false);
        fetchFolders();
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const updateFolder = async () => {
    if (!editFolderName.trim() || !editFolderData) return;
    
    try {
      const response = await fetch(`http://127.0.0.1:8000/folders/${editFolderData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editFolderName,
          color: editFolderColor
        })
      });
      
      if (response.ok) {
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
    if (folder === null) {
      // When selecting "All Research", show all conversations
      setConversations(allConversations);
    } else {
      fetchConversations(folder.id);
    }
  };

  const moveConversationToFolder = async (conversationId, folderId) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/conversations/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          folder_id: folderId
        })
      });

      if (response.ok) {
        // Refresh data to reflect the move
        await fetchData();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error moving conversation:', error);
      return false;
    }
  };

  const reorderFolders = async (newOrder) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/folders/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          folder_ids: newOrder
        })
      });

      if (response.ok) {
        // Update local state immediately for better UX
        const reorderedFolders = newOrder.map(id => folders.find(f => f.id === id));
        setFolders(reorderedFolders);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error reordering folders:', error);
      return false;
    }
  };

  const handleDeleteConversation = (conversation) => {
    setItemToDelete(conversation);
    setDeleteType('conversation');
    setShowDeleteModal(true);
  };

  const handleDeleteFolder = (folder) => {
    setItemToDelete(folder);
    setDeleteType('folder');
    setShowDeleteModal(true);
  };

  const handleEditFolder = (folder) => {
    setEditFolderData(folder);
    setEditFolderName(folder.name);
    setEditFolderColor(folder.color);
    setShowEditFolderModal(true);
  };

  const confirmDelete = async (deleteAllResearch = false) => {
    if (!itemToDelete) return;

    try {
      if (deleteType === 'conversation') {
        const response = await fetch(`http://127.0.0.1:8000/conversations/${itemToDelete.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setNotification({
            type: 'success',
            message: data.message
          });
          await fetchData();
        } else {
          throw new Error('Failed to delete research');
        }
      } else if (deleteType === 'folder') {
        const response = await fetch(`http://127.0.0.1:8000/folders/${itemToDelete.id}?delete_conversations=${deleteAllResearch}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setNotification({
            type: 'success',
            message: data.message
          });
          await fetchData();
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
    
    // Check if we're dragging a folder
    const isFolderDrag = active.id.toString().startsWith('folder-');
    setIsDraggingFolder(isFolderDrag);
  };

  const handleDragOver = (event) => {
    const { over } = event;
    setOverId(over?.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    setActiveId(null);
    setOverId(null);
    setIsDraggingFolder(false);

    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Handle folder reordering
    if (activeId.toString().startsWith('folder-') && overId.toString().startsWith('folder-')) {
      const activeFolderId = parseInt(activeId.toString().replace('folder-', ''));
      const overFolderId = parseInt(overId.toString().replace('folder-', ''));
      
      if (activeFolderId !== overFolderId) {
        const oldIndex = folders.findIndex(f => f.id === activeFolderId);
        const newIndex = folders.findIndex(f => f.id === overFolderId);
        
        // Create new order array
        const newFolders = [...folders];
        const [removed] = newFolders.splice(oldIndex, 1);
        newFolders.splice(newIndex, 0, removed);
        
        // Update state immediately for better UX
        setFolders(newFolders);
        
        // Send new order to backend
        const newOrder = newFolders.map(f => f.id);
        const success = await reorderFolders(newOrder);
        
        if (success) {
          setNotification({
            type: 'success',
            message: 'Folders reordered successfully'
          });
          setTimeout(() => setNotification(null), 3000);
        } else {
          // Revert on failure
          await fetchFolders();
          setNotification({
            type: 'error',
            message: 'Failed to reorder folders'
          });
          setTimeout(() => setNotification(null), 3000);
        }
      }
      return;
    }

    // Handle conversation moving to folders (existing logic)
    if (!activeId.toString().startsWith('folder-')) {
      const draggedConversationId = activeId;
      const droppedOnId = overId;

      // Check if dropped on a folder
      const targetFolder = folders.find(f => f.id === droppedOnId);
      const isDroppedOnAllResearch = droppedOnId === 'all-research';
      
      if (targetFolder || isDroppedOnAllResearch) {
        const targetFolderId = isDroppedOnAllResearch ? null : targetFolder.id;
        
        // Find the conversation being moved
        const conversation = conversations.find(c => c.id === draggedConversationId);
        
        // Only move if it's actually changing folders
        if (conversation && conversation.folder_id !== targetFolderId) {
          const success = await moveConversationToFolder(draggedConversationId, targetFolderId);
          
          if (success) {
            // Show success feedback
            setNotification({
              type: 'success',
              message: `Moved "${conversation.title}" to ${targetFolder?.name || 'All Research'}`
            });
            setTimeout(() => setNotification(null), 3000);
          } else {
            // Show error feedback
            setNotification({
              type: 'error',
              message: 'Failed to move conversation'
            });
            setTimeout(() => setNotification(null), 3000);
          }
        }
      }
    }
  };

  const startNewResearch = () => {
    const params = new URLSearchParams();
    if (selectedFolder) {
      params.set('folder_id', selectedFolder.id);
    }
    navigate(`/research?${params.toString()}`);
  };

  const openConversation = (conversation) => {
    navigate(`/research?convo_id=${conversation.id}`);
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
      <div className="min-h-screen bg-gray-50">
        <Header />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Research Dashboard</h1>
          <p className="text-gray-600">Organize and explore your research with intelligent folders</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold text-gray-900">{allConversations.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl font-bold text-gray-900">{allConversations.filter(conv => {
                  const oneWeekAgo = new Date();
                  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                  return new Date(conv.created_at) > oneWeekAgo;
                }).length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Folders</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalFolders}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Folders */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Folders</h2>
                <button
                  onClick={() => setShowNewFolderModal(true)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2">
                {/* All Research - Not draggable, only droppable */}
                <DroppableFolderButton
                  id="all-research"
                  folder={{ name: 'All Research', conversation_count: allConversations.length, color: '#6B7280' }}
                  isSelected={selectedFolder === null}
                  onSelect={() => selectFolder(null)}
                  isOver={overId === 'all-research'}
                  isDraggingFolder={isDraggingFolder}
                />

                {/* Draggable/Droppable Folder List */}
                <SortableContext 
                  items={[...folders.map(f => `folder-${f.id}`), ...folders.map(f => f.id)]} 
                  strategy={verticalListSortingStrategy}
                >
                  {folders.map((folder) => (
                    <DraggableFolderButton
                      key={folder.id}
                      folder={folder}
                      isSelected={selectedFolder?.id === folder.id}
                      onSelect={() => selectFolder(folder)}
                      isOverForDrop={overId === folder.id}
                      isOverForReorder={overId === `folder-${folder.id}`}
                      isDragging={activeId === `folder-${folder.id}`}
                      isDraggingFolder={isDraggingFolder}
                      onDelete={handleDeleteFolder}
                      onEdit={handleEditFolder}
                    />
                  ))}
                </SortableContext>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* New Research Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Start New Research</h2>
                <p className="text-gray-600 mb-6">
                  {selectedFolder 
                    ? `Creating research in "${selectedFolder.name}" folder`
                    : 'Begin your next research project with AI-powered insights'
                  }
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={startNewResearch}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors inline-flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Start Research
                  </button>
                  <button
                    onClick={() => navigate('/compare')}
                    className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium transition-colors inline-flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Compare Articles
                  </button>
                </div>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="mb-6">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search research reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Research Reports Grid */}
            <SortableContext 
              items={filteredConversations.map(c => c.id)} 
              strategy={verticalListSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredConversations.map((conversation) => (
                  <DraggableResearchCard
                    key={conversation.id}
                    conversation={conversation}
                    onOpen={openConversation}
                    onDelete={handleDeleteConversation}
                  />
                ))}
              </div>
            </SortableContext>

            {filteredConversations.length === 0 && (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No research reports found</h3>
                <p className="text-gray-600">
                  {selectedFolder 
                    ? `No reports in "${selectedFolder.name}" folder yet.`
                    : 'Start your first research project to see it here.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Folder</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
              <div className="flex space-x-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewFolderColor(color)}
                    className={`w-8 h-8 rounded-full border-2 ${
                      newFolderColor === color ? 'border-gray-900' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Folder Modal */}
      {showEditFolderModal && editFolderData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Folder</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Folder Name</label>
              <input
                type="text"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                placeholder="Enter folder name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
              <div className="flex space-x-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setEditFolderColor(color)}
                    className={`w-8 h-8 rounded-full border-2 ${
                      editFolderColor === color ? 'border-gray-900' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowEditFolderModal(false);
                  setEditFolderData(null);
                  setEditFolderName('');
                  setEditFolderColor('#3B82F6');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateFolder}
                disabled={!editFolderName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && itemToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            {deleteType === 'conversation' ? (
              <>
                <div className="flex items-center mb-4">
                  <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Research</h3>
                </div>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete <strong>"{itemToDelete.title}"</strong>? This action cannot be undone.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => confirmDelete()}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Delete Research
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center mb-4">
                  <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Folder</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  What would you like to do with the <strong>{itemToDelete.conversation_count} research items</strong> in the <strong>"{itemToDelete.name}"</strong> folder?
                </p>
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="space-y-3">
                    <label className="flex items-start">
                      <input
                        type="radio"
                        name="deleteOption"
                        value="move"
                        defaultChecked
                        className="mt-1 mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Move to "All Research"</div>
                        <div className="text-sm text-gray-600">Keep all research items but move them out of this folder</div>
                      </div>
                    </label>
                    <label className="flex items-start">
                      <input
                        type="radio"
                        name="deleteOption"
                        value="delete"
                        className="mt-1 mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900 text-red-700">Delete everything</div>
                        <div className="text-sm text-red-600">Permanently delete the folder and all research items inside</div>
                      </div>
                    </label>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const deleteAll = document.querySelector('input[name="deleteOption"]:checked').value === 'delete';
                      confirmDelete(deleteAll);
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${
          notification.type === 'success' 
            ? 'bg-green-50 border border-green-300 text-green-800' 
            : 'bg-red-50 border border-red-300 text-red-800'
        }`}>
          <div className="flex items-center">
            {notification.type === 'success' ? (
              <svg className="w-5 h-5 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 mr-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      )}
      </div>
      
      <DragOverlay>
        {activeId ? (
          <div className="bg-white rounded-xl shadow-lg border-2 border-blue-300 p-6 opacity-90">
            <div className="flex items-center space-x-3">
              {isDraggingFolder ? (
                <>
                  <div
                    className="w-4 h-4 rounded"
                    style={{ 
                      backgroundColor: folders.find(f => f.id === parseInt(activeId.toString().replace('folder-', '')))?.color || '#6B7280'
                    }}
                  ></div>
                  <span className="font-medium text-gray-900">
                    {folders.find(f => f.id === parseInt(activeId.toString().replace('folder-', '')))?.name || 'Folder'}
                  </span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium text-gray-900">
                    {conversations.find(c => c.id === activeId)?.title || 'Research Report'}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default Dashboard; 