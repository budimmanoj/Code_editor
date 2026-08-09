import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, File, Folder, Plus, Edit2, Trash2 } from 'lucide-react';
import './FileTree.css';

function FileIcon({ node }) {
  if (node.fileType === 'FOLDER') return <Folder size={14} className="ft-icon" />;
  return <File size={14} className="ft-icon" />;
}

function TreeNode({
  node, depth, selectedId,
  onSelect, onAddFile, onAddFolder, onDelete, onRename,
  isRoot,
}) {
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renamVal, setRenamVal] = useState(node.name);
  const renameInputRef = useRef(null);
  const isFolder = node.fileType === 'FOLDER';
  const isSelected = node.id === selectedId;
  const isVirtualRoot = node.id === null && node.name === '__root__';

  // Focus rename input when opened
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.select();
    }
  }, [renaming]);

  function submitRename() {
    const trimmed = renamVal.trim();
    if (trimmed && trimmed !== node.name) {
      onRename && onRename(node.id, trimmed);
    }
    setRenaming(false);
  }

  // Virtual root: render children directly without a row
  if (isVirtualRoot) {
    return (
      <div className="ft-virtual-root">
        {node.children?.map(child => (
          <TreeNode
            key={child.id}
            node={child}
            depth={0}
            selectedId={selectedId}
            onSelect={onSelect}
            onAddFile={onAddFile}
            onAddFolder={onAddFolder}
            onDelete={onDelete}
            onRename={onRename}
            isRoot={false}
          />
        ))}
        {/* Add root-level items */}
        <div className="ft-root-actions">
          <button className="ft-root-btn" title="New root file"
            onClick={() => onAddFile && onAddFile(null)}>
            <File size={14} />
            New File
          </button>
          <button className="ft-root-btn" title="New root folder"
            onClick={() => onAddFolder && onAddFolder(null)}>
            <Folder size={14} />
            New Folder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ft-node">
      <div
        className={`ft-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => {
          if (renaming) return;
          if (isFolder) setOpen(!open);
          else onSelect(node);
        }}
      >
        {isFolder && (
          <div className={`ft-arrow ${open ? 'open' : ''}`}><ChevronRight size={14} /></div>
        )}
        <FileIcon node={node} />

        {renaming ? (
          <input
            ref={renameInputRef}
            className="ft-rename-input"
            value={renamVal}
            onChange={e => setRenamVal(e.target.value)}
            onBlur={submitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') submitRename();
              if (e.key === 'Escape') { setRenamVal(node.name); setRenaming(false); }
              e.stopPropagation();
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="ft-name" onDoubleClick={e => {
            e.stopPropagation();
            setRenamVal(node.name);
            setRenaming(true);
          }}>{node.name}</span>
        )}

        {!renaming && (
          <div className="ft-actions" onClick={e => e.stopPropagation()}>
            {isFolder && (
              <>
                {typeof onAddFile === 'function' && (
                  <button className="ft-action-btn" title="New file in folder"
                    onClick={e => { e.stopPropagation(); onAddFile(node.id); }}>
                    <Plus size={12} />
                  </button>
                )}
                {typeof onAddFolder === 'function' && (
                  <button className="ft-action-btn" title="New folder"
                    onClick={e => { e.stopPropagation(); onAddFolder(node.id); }}>
                    <Folder size={12} />
                  </button>
                )}
              </>
            )}
            <button className="ft-action-btn" title="Rename (or double-click)"
              onClick={e => { e.stopPropagation(); setRenamVal(node.name); setRenaming(true); }}>
              <Edit2 size={12} />
            </button>
            {typeof onDelete === 'function' && (
              <button className="ft-action-btn delete-btn" title="Delete"
                onClick={e => { e.stopPropagation(); onDelete(node.id, node.name, isFolder); }}>
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {isFolder && open && node.children?.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          onAddFile={onAddFile}
          onAddFolder={onAddFolder}
          onDelete={onDelete}
          onRename={onRename}
        />
      ))}
    </div>
  );
}

export default function FileTree({
  tree, selectedId,
  onSelect, onAddFile, onAddFolder, onDelete, onRename,
}) {
  if (!tree) return (
    <div className="ft-empty">
      <span>No files yet</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {typeof onAddFile === 'function' && (
          <button className="btn-primary" onClick={() => onAddFile(null)}>New File</button>
        )}
        {typeof onAddFolder === 'function' && (
          <button className="btn-ghost" onClick={() => onAddFolder(null)}>New Folder</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="ft-wrap">
      <TreeNode
        node={tree}
        depth={0}
        selectedId={selectedId}
        onSelect={onSelect}
        onAddFile={onAddFile}
        onAddFolder={onAddFolder}
        onDelete={onDelete}
        onRename={onRename}
        isRoot
      />
      {/* If tree is a real single root (not virtual), show root-level add buttons */}
      {tree.id !== null && (
        <div className="ft-root-actions">
          {typeof onAddFile === 'function' && (
            <button className="ft-root-btn" title="New root file"
              onClick={() => onAddFile(null)}>
              <File size={14} /> New File
            </button>
          )}
          {typeof onAddFolder === 'function' && (
            <button className="ft-root-btn" title="New root folder"
              onClick={() => onAddFolder(null)}>
              <Folder size={14} /> New Folder
            </button>
          )}
        </div>
      )}
    </div>
  );
}
