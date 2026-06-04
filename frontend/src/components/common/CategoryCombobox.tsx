'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface CategoryOption {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
  color?: string | null;
  level?: number | null;
  parentId?: string | null;
  isActive?: boolean;
  parent?: {
    id: string;
    name: string;
    icon?: string | null;
  } | null;
}

interface Props {
  categories: CategoryOption[];
  value: string;
  onChange: (id: string) => void;
  /** Filtra por tipo: 'income' | 'expense' | undefined (mostra todos) */
  filterType?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  /** Cor do anel/foco (hex) */
  accentColor?: string;
}

function getCategoryTypeLabel(type: string): string {
  if (type === 'income') return 'Receita';
  if (type === 'expense') return 'Despesa';
  if (type === 'patrimonial') return 'Patrimonial';
  return type;
}

function getCategoryTypeBadgeClass(type: string): string {
  if (type === 'income') return 'bg-green-100 text-green-700';
  if (type === 'expense') return 'bg-red-100 text-red-700';
  if (type === 'patrimonial') return 'bg-sky-100 text-sky-700';
  return 'bg-gray-100 text-gray-700';
}

/**
 * Combobox de categorias com busca, agrupamento por categoria-pai
 * (level 1) e filtro por tipo (income/expense). Substitui o <select>
 * nativo, ordena alfabeticamente e separa Receitas / Despesas.
 */
export default function CategoryCombobox({
  categories,
  value,
  onChange,
  filterType,
  required,
  placeholder = 'Selecione uma categoria',
  className = '',
  accentColor = '#1F4FD8',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => categories.find((c) => c.id === value),
    [categories, value]
  );

  // Click fora fecha
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Foco automático no input ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const norm = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // Agrupa: chave = parent (level 1) | self se level=1
  const groups = useMemo(() => {
    const filtered = categories.filter((c) => {
      if (c.isActive === false) return false;
      if (filterType && c.type !== filterType) return false;
      if (!query) return true;
      const q = norm(query);
      return (
        norm(c.name).includes(q) ||
        norm(c.parent?.name || '').includes(q)
      );
    });

    // mapa de id->categoria para descobrir parents quando faltar `parent`
    const byId: Record<string, CategoryOption> = {};
    categories.forEach((c) => (byId[c.id] = c));

    // agrupa por parent top-level
    const map = new Map<string, { header: CategoryOption; items: CategoryOption[] }>();

    const ensure = (top: CategoryOption) => {
      if (!map.has(top.id)) map.set(top.id, { header: top, items: [] });
      return map.get(top.id)!;
    };

    filtered.forEach((c) => {
      const isTop = !c.parentId || c.level === 1;
      if (isTop) {
        ensure(c);
      } else {
        const top =
          (c.parent && byId[c.parent.id]) ||
          (c.parentId ? byId[c.parentId] : undefined);
        if (top) {
          ensure(top).items.push(c);
        } else {
          // sem pai conhecido: vira top próprio
          ensure(c);
        }
      }
    });

    // Ordena items alfabeticamente dentro de cada grupo
    map.forEach((g) => g.items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));

    // Ordena grupos: receitas primeiro, depois alfabético do nome do header
    const arr = Array.from(map.values()).sort((a, b) => {
      if (a.header.type !== b.header.type) {
        return a.header.type === 'income' ? -1 : 1;
      }
      return a.header.name.localeCompare(b.header.name, 'pt-BR');
    });

    return arr;
  }, [categories, filterType, query]);

  const totalCount = groups.reduce((s, g) => s + 1 + g.items.length, 0);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-[#F9FAFB] hover:bg-white text-left flex items-center justify-between gap-2 transition-all"
        style={{
          boxShadow: open ? `0 0 0 2px ${accentColor}33` : undefined,
          borderColor: open ? accentColor : undefined,
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {selected ? (
            <>
              <span className="text-lg">{selected.icon || '📁'}</span>
              <span className="truncate">
                {selected.parent?.name && (
                  <span className="text-gray-500 text-xs mr-1">
                    {selected.parent.name} ›
                  </span>
                )}
                <span className="text-gray-900">{selected.name}</span>
              </span>
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Mantém validação HTML5 quando required */}
      <input
        type="text"
        tabIndex={-1}
        aria-hidden
        required={required}
        value={value}
        onChange={() => {}}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
      />

      {open && (
        <div className="absolute z-50 mt-2 w-full bg-white border-2 border-gray-200 rounded-xl shadow-2xl overflow-hidden">
          {/* Busca */}
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar categoria..."
                className="w-full pl-9 pr-9 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{ boxShadow: `0 0 0 0` }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-72 overflow-y-auto">
            {totalCount === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                Nenhuma categoria encontrada
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.header.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(g.header.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-gray-50 ${
                      value === g.header.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className="text-lg">{g.header.icon || '📁'}</span>
                    <span className="font-semibold text-gray-800 flex-1 truncate">
                      {g.header.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCategoryTypeBadgeClass(g.header.type)}`}>
                      {getCategoryTypeLabel(g.header.type)}
                    </span>
                  </button>
                  {g.items.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onChange(c.id);
                        setOpen(false);
                        setQuery('');
                      }}
                      className={`w-full px-3 py-1.5 pl-10 flex items-center gap-2 text-left text-sm hover:bg-gray-50 ${
                        value === c.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <span className="text-base">{c.icon || '•'}</span>
                      <span className="text-gray-700 truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
