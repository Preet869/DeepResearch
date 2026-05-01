import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import analyticsService from '../services/analyticsService';

const LIBRARY_TABLE = 'research_library_items';
const LOCAL_STORAGE_KEY = 'researchLibrary';

const emptyFormState = () => ({
  title: '',
  description: '',
  category: 'research',
  url: '',
  tags: '',
  notes: ''
});

const tagsToArray = (tags) => {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
};

const tagsToInputString = (tags) => tagsToArray(tags).join(', ');

const sameId = (a, b) => String(a) === String(b);

const rowToItem = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description ?? '',
  category: row.category,
  url: row.url ?? '',
  tags: Array.isArray(row.tags) ? row.tags : tagsToArray(row.tags),
  notes: row.notes ?? '',
  createdAt: row.created_at,
  lastAccessed: row.last_accessed_at
});

const ResearchLibrary = ({ onClose }) => {
  const { user } = useAuth();
  const useCloud = Boolean(supabase && user?.id);

  const [library, setLibrary] = useState([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState(emptyFormState);
  const [libraryLoading, setLibraryLoading] = useState(useCloud);
  const [loadError, setLoadError] = useState(null);
  const [componentStartTime] = useState(Date.now());

  // Track component mount
  useEffect(() => {
    analyticsService.trackFeatureUsage('research_library', 'opened', {
      user_has_cloud: useCloud,
      library_size: library.length
    });

    // Cleanup function to track component unmount
    return () => {
      analyticsService.trackFeatureUsage('research_library', 'closed', {
        session_duration_ms: Date.now() - componentStartTime,
        final_library_size: library.length,
        actions_performed: {
          had_search: searchTerm.length > 0,
          used_category_filter: filterCategory !== 'all',
          opened_add_form: showAddForm
        }
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = [
    { id: 'all', name: 'All Items', icon: '📚' },
    { id: 'research', name: 'Research Papers', icon: '🔬' },
    { id: 'articles', name: 'Articles', icon: '📰' },
    { id: 'books', name: 'Books', icon: '📖' },
    { id: 'reports', name: 'Reports', icon: '📊' },
    { id: 'notes', name: 'Notes', icon: '📝' }
  ];

  const migrateLocalToCloud = useCallback(
    async (userId) => {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
      if (!Array.isArray(parsed) || parsed.length === 0) return [];

      const rows = parsed.map((entry) => ({
        user_id: userId,
        title: entry.title,
        description: entry.description || null,
        category: entry.category || 'research',
        url: entry.url || null,
        tags: tagsToArray(entry.tags),
        notes: entry.notes || null,
        created_at: entry.createdAt || new Date().toISOString(),
        last_accessed_at: entry.lastAccessed || new Date().toISOString()
      }));

      const { data, error } = await supabase.from(LIBRARY_TABLE).insert(rows).select();
      if (error) throw error;
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return (data || []).map(rowToItem);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const loadLocalOnly = () => {
      const savedLibrary = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!savedLibrary) {
        setLibrary([]);
        return;
      }
      try {
        const parsed = JSON.parse(savedLibrary);
        if (Array.isArray(parsed)) {
          setLibrary(
            parsed.map((entry) => ({
              ...entry,
              tags: tagsToArray(entry.tags)
            }))
          );
        }
      } catch {
        setLibrary([]);
      }
    };

    const loadFromSupabase = async () => {
      setLibraryLoading(true);
      setLoadError(null);
      const startTime = Date.now();
      
      try {
        const { data, error } = await supabase
          .from(LIBRARY_TABLE)
          .select('*')
          .order('last_accessed_at', { ascending: false });

        if (error) throw error;
        if (cancelled) return;

        let items = (data || []).map(rowToItem);
        if (items.length === 0) {
          try {
            const migrated = await migrateLocalToCloud(user.id);
            if (migrated.length > 0) items = migrated;
          } catch (migrateErr) {
            console.error('Research library migration failed:', migrateErr);
            analyticsService.trackError('library_migration_failed', migrateErr.message);
          }
        }
        setLibrary(items);
        
        // Track successful library load
        analyticsService.trackLibraryAction('library_loaded', {
          items_count: items.length,
          load_time_ms: Date.now() - startTime,
          source: 'supabase'
        });
        
      } catch (e) {
        console.error('Research library load failed:', e);
        analyticsService.trackError('library_load_failed', e.message, e.stack);
        if (!cancelled) {
          setLoadError(
            'Could not load your library from the server. If this is a new setup, run the Supabase migration for research_library_items.'
          );
          setLibrary([]);
        }
      } finally {
        if (!cancelled) setLibraryLoading(false);
      }
    };

    if (!useCloud) {
      setLibraryLoading(false);
      loadLocalOnly();
      return () => {
        cancelled = true;
      };
    }

    loadFromSupabase();
    return () => {
      cancelled = true;
    };
  }, [useCloud, user?.id, migrateLocalToCloud]);

  useEffect(() => {
    if (useCloud) return;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(library));
  }, [library, useCloud]);

  const handleAddItem = async () => {
    if (!newItem.title) return;

    const tags = tagsToArray(newItem.tags);
    const isUpdate = newItem.id != null && newItem.id !== '';
    const startTime = Date.now();

    if (useCloud) {
      try {
        if (isUpdate) {
          const now = new Date().toISOString();
          const { data, error } = await supabase
            .from(LIBRARY_TABLE)
            .update({
              title: newItem.title,
              description: newItem.description || null,
              category: newItem.category,
              url: newItem.url || null,
              tags,
              notes: newItem.notes || null,
              last_accessed_at: now
            })
            .eq('id', newItem.id)
            .select()
            .single();
          if (error) throw error;
          const updated = rowToItem(data);
          setLibrary((prev) => prev.map((item) => (sameId(item.id, updated.id) ? updated : item)));
          
          // Track update
          analyticsService.trackLibraryAction('item_updated', {
            id: updated.id,
            category: updated.category,
            tags: updated.tags,
            has_url: !!updated.url,
            has_description: !!updated.description,
            has_notes: !!updated.notes,
            operation_time_ms: Date.now() - startTime
          });
        } else {
          const { data, error } = await supabase
            .from(LIBRARY_TABLE)
            .insert({
              user_id: user.id,
              title: newItem.title,
              description: newItem.description || null,
              category: newItem.category,
              url: newItem.url || null,
              tags,
              notes: newItem.notes || null
            })
            .select()
            .single();
          if (error) throw error;
          const newLibraryItem = rowToItem(data);
          setLibrary((prev) => [newLibraryItem, ...prev]);
          
          // Track addition
          analyticsService.trackLibraryAction('item_added', {
            id: newLibraryItem.id,
            category: newLibraryItem.category,
            tags: newLibraryItem.tags,
            has_url: !!newLibraryItem.url,
            has_description: !!newLibraryItem.description,
            has_notes: !!newLibraryItem.notes,
            tag_count: tags.length,
            operation_time_ms: Date.now() - startTime
          });
        }
      } catch (e) {
        console.error('Research library save failed:', e);
        analyticsService.trackError('library_save_failed', e.message, e.stack, {
          action: isUpdate ? 'update' : 'add',
          item_category: newItem.category
        });
        return;
      }
    } else if (isUpdate) {
      setLibrary((prev) =>
        prev.map((item) =>
          sameId(item.id, newItem.id)
            ? {
                ...item,
                title: newItem.title,
                description: newItem.description,
                category: newItem.category,
                url: newItem.url,
                tags,
                notes: newItem.notes,
                lastAccessed: new Date().toISOString()
              }
            : item
        )
      );
      
      analyticsService.trackLibraryAction('item_updated', {
        id: newItem.id,
        category: newItem.category,
        tags,
        source: 'local_storage'
      });
    } else {
      const item = {
        id: Date.now(),
        title: newItem.title,
        description: newItem.description,
        category: newItem.category,
        url: newItem.url,
        tags,
        notes: newItem.notes,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      };
      setLibrary((prev) => [...prev, item]);
      
      analyticsService.trackLibraryAction('item_added', {
        id: item.id,
        category: item.category,
        tags,
        source: 'local_storage',
        tag_count: tags.length
      });
    }

    setNewItem(emptyFormState());
    setShowAddForm(false);
  };

  const handleDeleteItem = async (id) => {
    const itemToDelete = library.find((item) => sameId(item.id, id));
    
    if (useCloud) {
      try {
        const { error } = await supabase.from(LIBRARY_TABLE).delete().eq('id', id);
        if (error) throw error;
        
        // Track deletion
        analyticsService.trackLibraryAction('item_deleted', {
          id,
          category: itemToDelete?.category,
          had_url: !!itemToDelete?.url,
          tag_count: itemToDelete?.tags?.length || 0
        });
      } catch (e) {
        console.error('Research library delete failed:', e);
        analyticsService.trackError('library_delete_failed', e.message, e.stack, { item_id: id });
        return;
      }
    } else {
      analyticsService.trackLibraryAction('item_deleted', {
        id,
        category: itemToDelete?.category,
        source: 'local_storage'
      });
    }
    setLibrary((prev) => prev.filter((item) => !sameId(item.id, id)));
  };

  const handleEditItem = (id) => {
    const item = library.find((i) => sameId(i.id, id));
    if (item) {
      setNewItem({
        ...item,
        tags: tagsToInputString(item.tags)
      });
      setShowAddForm(true);
    }
  };

  const handleAccessItem = async (id) => {
    const now = new Date().toISOString();
    const item = library.find((item) => sameId(item.id, id));
    
    if (useCloud) {
      try {
        const { error } = await supabase
          .from(LIBRARY_TABLE)
          .update({ last_accessed_at: now })
          .eq('id', id);
        if (error) throw error;
      } catch (e) {
        console.error('Research library touch failed:', e);
        return;
      }
    }
    
    // Track item access
    analyticsService.trackLibraryAction('item_accessed', {
      id,
      category: item?.category,
      has_url: !!item?.url,
      access_method: 'library_open'
    });
    
    setLibrary((prev) =>
      prev.map((item) => (sameId(item.id, id) ? { ...item, lastAccessed: now } : item))
    );
  };

  const q = searchTerm.trim().toLowerCase();
  const filteredItems = library.filter((item) => {
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const title = (item.title || '').toLowerCase();
    const description = (item.description || '').toLowerCase();
    const tagList = tagsToArray(item.tags);
    const matchesSearch =
      !q ||
      title.includes(q) ||
      description.includes(q) ||
      tagList.some((tag) => tag.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const sortedItems = [...filteredItems].sort(
    (a, b) => new Date(b.lastAccessed) - new Date(a.lastAccessed)
  );

  const getCategoryIcon = (category) => {
    const categoryMap = {
      research: '🔬',
      articles: '📰',
      books: '📖',
      reports: '📊',
      notes: '📝'
    };
    return categoryMap[category] || '📄';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const openUrl = (url) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const copyUrl = async (url, itemId) => {
    if (url) {
      try {
        await navigator.clipboard.writeText(url);
        // Track URL copy action
        analyticsService.trackLibraryAction('url_copied', {
          item_id: itemId,
          url_domain: new URL(url).hostname
        });
      } catch (error) {
        console.error('Failed to copy URL:', error);
        analyticsService.trackError('clipboard_copy_failed', error.message);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Research Library</h2>
              {useCloud && (
                <p className="text-xs text-gray-500 mt-1">Synced to your account (Supabase).</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {loadError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-800 text-sm">{loadError}</div>
          )}

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Category
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setFilterCategory(category.id);
                      // Track category filter usage
                      analyticsService.trackLibraryAction('category_filtered', {
                        category: category.id,
                        previous_category: filterCategory
                      });
                    }}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      filterCategory === category.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="mr-1">{category.icon}</span>
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Library
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setSearchTerm(newValue);
                    
                    // Track search behavior
                    if (newValue.length > 2) {
                      analyticsService.trackLibraryAction('search_performed', {
                        query: newValue,
                        query_length: newValue.length,
                        current_category: filterCategory,
                        total_items: library.length
                      });
                    }
                  }}
                  placeholder="Search by title, description, or tags..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={() => {
                  setNewItem(emptyFormState());
                  setShowAddForm(true);
                  // Track when user initiates adding new item
                  analyticsService.trackLibraryAction('add_form_opened', {
                    current_items_count: library.length,
                    current_category_filter: filterCategory
                  });
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Item
              </button>
            </div>
          </div>

          {/* Add Item Form */}
          {showAddForm && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {newItem.id ? 'Edit Library Item' : 'Add New Item'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={newItem.title}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Item title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="research">Research Papers</option>
                    <option value="articles">Articles</option>
                    <option value="books">Books</option>
                    <option value="reports">Reports</option>
                    <option value="notes">Notes</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newItem.description}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="2"
                    placeholder="Brief description of the item..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    value={newItem.url}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={newItem.tags}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={newItem.notes}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewItem(emptyFormState());
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAddItem()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {newItem.id ? 'Update' : 'Add'} Item
                </button>
              </div>
            </div>
          )}

          {/* Library Items */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Library Items ({sortedItems.length})
              </h3>
              <div className="text-sm text-gray-500">
                {library.length} total items
              </div>
            </div>

            {libraryLoading ? (
              <div className="text-center py-12 text-gray-500 text-sm">Loading library…</div>
            ) : sortedItems.length > 0 ? (
              <div className="grid gap-4">
                {sortedItems.map((item) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{getCategoryIcon(item.category)}</span>
                          <h4 className="font-medium text-gray-900">{item.title}</h4>
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                            {item.category}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                        )}
                        {tagsToArray(item.tags).length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {tagsToArray(item.tags).map((tag, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>Added: {formatDate(item.createdAt)}</span>
                          <span>Last accessed: {formatDate(item.lastAccessed)}</span>
                        </div>
                        {item.notes && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                            <strong>Notes:</strong> {item.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {item.url && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                openUrl(item.url);
                                handleAccessItem(item.id);
                              }}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => copyUrl(item.url, item.id)}
                              className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                            >
                              Copy URL
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEditItem(item.id)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : library.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p>No library items found.</p>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No items match your current search or category filter.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResearchLibrary;
