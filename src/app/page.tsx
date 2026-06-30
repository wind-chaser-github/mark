'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Upload, Loader2, Trash2, Folder, Tag as TagIcon, Globe, Settings, Edit3, X, Sparkles, FolderPlus, CheckSquare, Move, MoreHorizontal, LogOut } from 'lucide-react';

// Recursive Category Tree Component
const CategoryNode = ({ category, selectedCategory, onSelect, onAddSub, onEdit, depth = 0 }: any) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="w-full">
      <div 
        className={`group flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer ${
          selectedCategory === category.id 
            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] border border-indigo-500/20' 
            : 'hover:bg-black/5 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-300 border border-transparent'
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        onClick={() => {
          onSelect(category.id);
          setExpanded(!expanded);
        }}
      >
        <div className="flex items-center gap-2 truncate">
          <Folder className={`h-3.5 w-3.5 opacity-70 ${expanded ? 'fill-current opacity-30' : ''}`} /> 
          {category.name}
        </div>
        <div className="flex items-center gap-1">
          {category._count?.bookmarks > 0 && (
            <span className="text-xs opacity-50 bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-full">{category._count.bookmarks}</span>
          )}
          <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onAddSub(category.id); }} className="p-1 hover:text-indigo-500"><FolderPlus className="h-3 w-3" /></button>
            <button onClick={(e) => { e.stopPropagation(); onEdit(category); }} className="p-1 hover:text-indigo-500"><Edit3 className="h-3 w-3" /></button>
          </div>
        </div>
      </div>
      {expanded && category.children && category.children.length > 0 && (
        <div className="mt-1 flex flex-col space-y-1 relative">
          <div className="absolute left-4 top-0 bottom-0 w-[1px] bg-black/5 dark:bg-white/10 ml-[2px]" style={{ left: `${depth * 12 + 18}px` }}></div>
          {category.children.map((child: any) => (
            <CategoryNode 
              key={child.id} category={child} selectedCategory={selectedCategory} 
              onSelect={onSelect} onAddSub={onAddSub} onEdit={onEdit} depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [flatCategories, setFlatCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Batch Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ OPENAI_API_KEY: '', OPENAI_BASE_URL: '', OPENAI_MODEL: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  // Edit Bookmark
  const [editBookmark, setEditBookmark] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editCatId, setEditCatId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Edit/Add Category
  const [catModal, setCatModal] = useState<{show: boolean, type: 'add'|'edit'|'addSub', targetId?: string, name: string}>({show: false, type: 'add', name: ''});

  // Add Bookmark Modal
  const [addModal, setAddModal] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addingBookmark, setAddingBookmark] = useState(false);

  // Batch Move Modal
  const [moveModal, setMoveModal] = useState(false);
  const [moveToCat, setMoveToCat] = useState('');

  useEffect(() => {
    fetchSidebarData();
  }, []);

  useEffect(() => {
    fetchBookmarks();
    setSelectedIds(new Set()); // clear selection on view change
  }, [search, selectedCategory, selectedTag]);

  const fetchSidebarData = async () => {
    try {
      const res = await fetch('/api/categories', { cache: 'no-store' });
      const data = await res.json();
      setCategories(data.categories || []);
      setFlatCategories(data.flatCategories || []);
      setTags(data.tags || []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchBookmarks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (selectedTag) params.append('tagId', selectedTag);

      const res = await fetch(`/api/bookmarks?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      setBookmarks(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBatchAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    if (action === 'DELETE') {
      if (!confirm(`确定要删除选中的 ${selectedIds.size} 个书签吗？`)) return;
      try {
        await fetch('/api/bookmarks/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'DELETE', ids: Array.from(selectedIds) })
        });
        setSelectedIds(new Set());
        fetchBookmarks();
        fetchSidebarData();
      } catch(e) {}
    } else if (action === 'MOVE') {
      setMoveModal(true);
    }
  };

  const confirmBatchMove = async () => {
    if (!moveToCat) return alert('请选择目标分类');
    try {
      await fetch('/api/bookmarks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MOVE', ids: Array.from(selectedIds), categoryId: moveToCat })
      });
      setMoveModal(false);
      setSelectedIds(new Set());
      fetchBookmarks();
      fetchSidebarData();
    } catch (e) {}
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个书签吗？')) return;
    try {
      const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBookmarks(bookmarks.filter(b => b.id !== id));
        fetchSidebarData();
      }
    } catch (error) {}
  };

  const saveCategory = async () => {
    try {
      if (catModal.type === 'edit' && catModal.targetId) {
        await fetch(`/api/categories/${catModal.targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catModal.name })
        });
      } else {
        await fetch(`/api/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: catModal.name, 
            parentId: catModal.type === 'addSub' ? catModal.targetId : null 
          })
        });
      }
      setCatModal({show: false, type: 'add', name: ''});
      fetchSidebarData();
    } catch(e) {}
  };

  const deleteCategory = async () => {
    if (!catModal.targetId) return;
    if (!confirm('确定要删除这个文件夹吗？其下的书签会被移动到“未分类”。')) return;
    try {
      await fetch(`/api/categories/${catModal.targetId}`, { method: 'DELETE' });
      setCatModal({show: false, type: 'add', name: ''});
      if (selectedCategory === catModal.targetId) setSelectedCategory(null);
      fetchSidebarData();
      fetchBookmarks();
    } catch(e) {}
  };

  const handleAddBookmark = async () => {
    if (!addUrl || !addUrl.startsWith('http')) return alert('请输入合法的 URL (http/https)');
    setAddingBookmark(true);
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: addUrl, rawTitle: addUrl })
      });
      if (res.ok) {
        setAddModal(false);
        setAddUrl('');
        fetchBookmarks();
        fetchSidebarData();
      } else {
        const err = await res.json();
        alert('添加失败: ' + err.error);
      }
    } finally {
      setAddingBookmark(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/bookmarks/import', { method: 'POST', body: formData });
      const data = await res.json();
      alert(`导入完成！成功: ${data.imported}, 跳过重复: ${data.skipped}`);
      fetchBookmarks();
      fetchSidebarData();
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const openSettings = async () => {
    setShowSettings(true);
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings({ OPENAI_API_KEY: data.OPENAI_API_KEY||'', OPENAI_BASE_URL: data.OPENAI_BASE_URL||'', OPENAI_MODEL: data.OPENAI_MODEL||'' });
    } catch (e) {}
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      setShowSettings(false);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('确定要退出当前账号吗？')) return;
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/login';
      }
    } catch (e) {}
  };

  const openEdit = (bookmark: any) => {
    setEditBookmark(bookmark);
    setEditTitle(bookmark.title || '');
    setEditTags(bookmark.tags.map((t: any) => t.name).join(', '));
    setEditCatId(bookmark.categoryId || '');
  };

  const saveEdit = async () => {
    if (!editBookmark) return;
    setSavingEdit(true);
    try {
      const tagsArray = editTags.split(',').map(t => t.trim()).filter(Boolean);
      const res = await fetch(`/api/bookmarks/${editBookmark.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, tags: tagsArray, categoryId: editCatId || null })
      });
      if (res.ok) {
        setEditBookmark(null);
        fetchBookmarks();
        fetchSidebarData();
      }
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex selection:bg-indigo-500/30">
      
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/20 dark:border-white/5 bg-white/40 dark:bg-black/40 backdrop-blur-2xl flex-shrink-0 hidden md:flex flex-col h-screen sticky top-0">
        <div className="p-6 pb-4">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
            <Sparkles className="h-5 w-5 text-indigo-500" /> Mark.AI
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 space-y-8 pb-4">
          <div>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Categories</h3>
              <button onClick={() => setCatModal({show:true, type:'add', name:''})} className="text-zinc-400 hover:text-indigo-500 p-1"><FolderPlus className="h-4 w-4" /></button>
            </div>
            <ul className="space-y-1">
              <li>
                <button 
                  onClick={() => { setSelectedCategory(null); setSelectedTag(null); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-300 ${!selectedCategory && !selectedTag ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium' : 'hover:bg-black/5 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-300'}`}
                >
                  全部书签
                </button>
              </li>
              {categories.map(c => (
                <li key={c.id}>
                  <CategoryNode 
                    category={c} 
                    selectedCategory={selectedCategory} 
                    onSelect={(id:string) => { setSelectedCategory(id); setSelectedTag(null); }}
                    onAddSub={(id:string) => setCatModal({show:true, type:'addSub', targetId: id, name:''})}
                    onEdit={(cat:any) => setCatModal({show:true, type:'edit', targetId: cat.id, name: cat.name})}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3 px-1">Popular Tags</h3>
            <div className="flex flex-wrap gap-2">
              {tags.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTag(t.id); setSelectedCategory(null); }}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-all duration-300 flex items-center gap-1.5
                    ${selectedTag === t.id 
                      ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30' 
                      : 'bg-white/50 border-black/5 hover:border-black/15 text-zinc-600 dark:bg-black/20 dark:border-white/10 dark:text-zinc-400'}`}
                >
                  <TagIcon className="h-3 w-3 opacity-70" /> {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 pt-4 border-t border-white/10 dark:border-white/5 flex gap-2 bg-white/20 dark:bg-black/20 backdrop-blur-md">
          <button 
            onClick={openSettings}
            className="flex-1 flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors bg-white/30 dark:bg-white/5 hover:bg-white/50 dark:hover:bg-white/10 py-2.5 rounded-xl border border-white/20 dark:border-white/5 backdrop-blur-md"
          >
            <Settings className="h-4 w-4" /> 配置
          </button>
          <button 
            onClick={handleLogout}
            className="flex-none px-3 flex items-center justify-center text-zinc-500 hover:text-red-500 transition-colors bg-white/30 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 py-2.5 rounded-xl border border-white/20 dark:border-white/5 backdrop-blur-md"
            title="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full relative pb-32">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 mt-4">
          <div className="relative flex-1 max-w-xl group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input 
              className="pl-11 h-12 rounded-full bg-white/70 dark:bg-black/50 border-white/20 dark:border-white/10 shadow-sm backdrop-blur-xl focus:ring-2 focus:ring-indigo-500/50 text-base" 
              placeholder="搜索书签、摘要..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2 items-center">
            {selectedIds.size > 0 && (
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 h-10 px-4 rounded-full">
                已选 {selectedIds.size} 项
              </Badge>
            )}
            <button onClick={() => setAddModal(true)} className="inline-flex items-center justify-center rounded-full border border-white/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium h-12 px-6 hover:bg-indigo-500/20 transition-all text-sm">
              + 添加书签
            </button>
            <input type="file" id="import-upload" className="hidden" accept=".html" onChange={handleImport} disabled={importing} />
            <label htmlFor="import-upload" className={`cursor-pointer inline-flex items-center justify-center rounded-full border border-white/20 bg-white/50 shadow-sm text-sm font-medium h-12 px-6 hover:bg-white/80 transition-all ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              导入书签
            </label>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-32"><Loader2 className="h-10 w-10 animate-spin text-indigo-500/50" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {bookmarks.map((bookmark, index) => {
              const isSelected = selectedIds.has(bookmark.id);
              return (
                <Card 
                  key={bookmark.id} 
                  className={`group relative flex flex-col bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border hover:-translate-y-1.5 transition-all duration-300 ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-xl' : 'border-white/40 dark:border-white/10 hover:shadow-xl hover:shadow-indigo-500/10'}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Select Checkbox Overlay */}
                  <div 
                    className={`absolute top-4 left-4 z-10 cursor-pointer ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                    onClick={() => toggleSelect(bookmark.id)}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-300 dark:border-zinc-600 bg-white/50 hover:border-indigo-400'}`}>
                      {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                    </div>
                  </div>

                  <CardHeader className="pb-4 flex-1 pl-12">
                    <div className="flex justify-between items-start gap-4">
                      <CardTitle className="text-base leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300">
                        <a href={bookmark.url} target="_blank" rel="noreferrer" className="flex items-start gap-2.5">
                          {bookmark.favicon ? (
                            <img src={bookmark.favicon} alt="" className="w-4 h-4 mt-0.5 rounded-sm flex-shrink-0 shadow-sm" />
                          ) : (
                            <Globe className="w-4 h-4 mt-0.5 opacity-40 flex-shrink-0" />
                          )}
                          <span className="line-clamp-2 leading-snug">{bookmark.title || bookmark.url}</span>
                        </a>
                      </CardTitle>
                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 flex-shrink-0 -mr-2">
                        <button onClick={() => openEdit(bookmark)} className="p-1.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-md transition-all"><Edit3 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDelete(bookmark.id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                    <CardDescription className="line-clamp-3 mt-3 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {bookmark.description}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-0 pb-5 pl-12">
                    <div className="flex flex-wrap gap-2 mt-auto">
                      {bookmark.category && (
                        <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium px-2 py-0.5">
                          {bookmark.category.name}
                        </Badge>
                      )}
                      {bookmark.tags.map((tag: any) => (
                        <Badge key={tag.id} variant="outline" className="text-zinc-500 dark:text-zinc-400 font-normal px-2 py-0.5 border-black/5 bg-black/5">
                          #{tag.name}
                        </Badge>
                      ))}
                    </div>
                  </CardFooter>
                </Card>
              )
            })}
            
            {bookmarks.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-32 text-zinc-400">
                <Sparkles className="h-10 w-10 text-indigo-400 mb-6" />
                <p className="text-lg font-medium text-zinc-500">空空如也，快去收集知识吧！</p>
              </div>
            )}
          </div>
        )}

        {/* Floating Batch Action Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="bg-zinc-900/90 dark:bg-white/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-full px-6 py-4 flex items-center gap-4 text-white dark:text-black">
              <span className="text-sm font-medium mr-4">已选中 {selectedIds.size} 项</span>
              <button onClick={() => handleBatchAction('MOVE')} className="flex items-center gap-2 text-sm hover:text-indigo-400 dark:hover:text-indigo-600 transition-colors"><Move className="h-4 w-4" /> 移动</button>
              <div className="w-px h-4 bg-white/20 dark:bg-black/20"></div>
              <button onClick={() => handleBatchAction('DELETE')} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 dark:text-red-600 dark:hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /> 删除</button>
              <div className="w-px h-4 bg-white/20 dark:bg-black/20"></div>
              <button onClick={() => setSelectedIds(new Set())} className="p-1 hover:bg-white/10 dark:hover:bg-black/10 rounded-full"><X className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-xl font-bold mb-6">系统配置</h3>
            <div className="space-y-5">
              <Input type="password" value={settings.OPENAI_API_KEY} onChange={e => setSettings({...settings, OPENAI_API_KEY: e.target.value})} placeholder="API Key" />
              <Input value={settings.OPENAI_BASE_URL} onChange={e => setSettings({...settings, OPENAI_BASE_URL: e.target.value})} placeholder="Base URL" />
              <Input value={settings.OPENAI_MODEL} onChange={e => setSettings({...settings, OPENAI_MODEL: e.target.value})} placeholder="Model" />
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSettings(false)}>取消</Button>
              <Button onClick={saveSettings}>保存</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Bookmark Modal */}
      {editBookmark && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-xl font-bold mb-6">编辑书签</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">标题</label>
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-1">所属分类</label>
                <select 
                  value={editCatId} 
                  onChange={e => setEditCatId(e.target.value)} 
                  className="w-full h-10 px-3 rounded-md border border-zinc-200 bg-white/50"
                >
                  <option value="">(无分类)</option>
                  {flatCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">标签 (逗号分隔)</label>
                <Input value={editTags} onChange={e => setEditTags(e.target.value)} />
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditBookmark(null)}>取消</Button>
              <Button onClick={saveEdit}>保存</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bookmark Modal */}
      {addModal && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-xl font-bold mb-6">添加新书签</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">链接 (URL)</label>
                <Input value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="https://..." autoFocus />
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <Button variant="outline" onClick={() => {setAddModal(false); setAddUrl('')}}>取消</Button>
              <Button onClick={handleAddBookmark} disabled={addingBookmark}>{addingBookmark ? '添加中...' : '确认添加'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Add Category Modal */}
      {catModal.show && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-sm p-8">
            <h3 className="text-xl font-bold mb-6">
              {catModal.type === 'add' ? '新建文件夹' : catModal.type === 'addSub' ? '新建子文件夹' : '重命名文件夹'}
            </h3>
            <Input 
              value={catModal.name} 
              onChange={e => setCatModal({...catModal, name: e.target.value})} 
              placeholder="文件夹名称" 
              autoFocus 
            />
            <div className="mt-8 flex justify-between">
              {catModal.type === 'edit' ? (
                <Button variant="destructive" onClick={deleteCategory}>删除该文件夹</Button>
              ) : <div></div>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCatModal({show:false, type:'add', name:''})}>取消</Button>
                <Button onClick={saveCategory}>确认</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Move Modal */}
      {moveModal && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl w-full max-w-sm p-8">
            <h3 className="text-xl font-bold mb-6">移动 {selectedIds.size} 个书签</h3>
            <select 
              value={moveToCat} 
              onChange={e => setMoveToCat(e.target.value)} 
              className="w-full h-10 px-3 rounded-md border border-zinc-200 bg-white/50 mb-6"
            >
              <option value="" disabled>请选择目标分类...</option>
              {flatCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setMoveModal(false)}>取消</Button>
              <Button onClick={confirmBatchMove}>确认移动</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
