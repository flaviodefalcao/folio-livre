import "./bookshelf.css";
import {useCoverColors, type CoverColors} from "./cover-colors";
import "./reading-tools.css";
import { useEffect, useRef, useState, useMemo, lazy, Suspense } from "react";
import {
  BookOpen,
  LayoutGrid,
  Columns3,
  Network,
  Sun,
  Moon,
  Plus,
  Search,
  Library,
  Heart,
  Folder,
  Compass,
  Settings as SettingsIcon,
  ArrowUpRight,
  MoreHorizontal,
  ChevronRight,
  Download,
  Trash2,
  X,
  Check,
  Highlighter,
  BarChart3,
  Minimize2,
  Maximize2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ArrowDownUp,
} from "lucide-react";
import { loadBooks, saveBook, deleteBook, importEpub } from "./books";
import type { BookRecord, Settings } from "./types";
const ConceptMap = lazy(()=>import("./ConceptMap"));
const FavoritePassages = lazy(()=>import("./FavoritePassages"));
import { loadMetrics, recordCompletion } from "./metrics-store";
const KindleConnect = lazy(() => import("./KindleConnect"));
const Catalog = lazy(() => import("./CatalogView"));
const Statistics = lazy(() => import("./Statistics"));
const NextReads = lazy(() => import("./NextReads"));
const Reader = lazy(() => import("./Reader"));

const defaultSettings: Settings = {
  annaUrl: localStorage.getItem("folio:anna-url") || "https://annas-archive.gd",
};
export async function openExternal(url: string) {
  if (window.folio) await window.folio.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}
export default function App() {
  const [appTheme, setAppTheme] = useState<"light" | "dark">(() =>
    localStorage.getItem("folio:theme") === "light" ? "light" : "dark",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = appTheme;
    document.documentElement.style.colorScheme = appTheme;
    void window.folio?.setAppTheme?.(appTheme).catch(() => {});
    localStorage.setItem("folio:theme", appTheme);
  }, [appTheme]);
  useEffect(() => {
    const theme = (event: Event) =>
      setAppTheme((event as CustomEvent).detail === "light" ? "light" : "dark");
    window.addEventListener("folio-theme-change", theme);
    return () => window.removeEventListener("folio-theme-change", theme);
  }, []);
  const [books, setBooks] = useState<BookRecord[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [initialTarget,setInitialTarget]=useState<string>();
  const [active, setActive] = useState<string | null>(null),
    [view, setView] = useState("library"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("recent");
  const [settings, setSettings] = useState(defaultSettings),
    [modal, setModal] = useState<
      "settings" | "download" | "collections" | null
    >(null);
  const [busy, setBusy] = useState(false),
    [menu, setMenu] = useState<string | null>(null),
    [drag, setDrag] = useState(false);
  const [libraryDisplay, setLibraryDisplay] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("folio:library-display") || "{}",
      );
      return {
        mode: saved.mode === "shelf" ? "shelf" as const : "standard" as const,
        compactHeader: saved.compactHeader === true,
        continueCollapsed: saved.continueCollapsed === true,
        minimal: saved.minimal !== false,
        coverSize: Math.max(70, Math.min(180, Number(saved.coverSize) || 100)),
      };
    } catch {
      return {
        mode: "standard" as "standard" | "shelf",
        compactHeader: false,
        continueCollapsed: false,
        minimal: true,
        coverSize: 100,
      };
    }
  });
  const covers = useMemo(() => books.map(book => book.cover), [books]);
  const coverColors = useCoverColors(covers, libraryDisplay.mode === "shelf");
  const [libraryOptions, setLibraryOptions] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isBookView = !["concepts", "quotes", "next", "discover", "statistics", "notes", "kindle"].includes(
    view,
  );
  useEffect(() => {
    try {
      localStorage.setItem(
        "folio:library-display",
        JSON.stringify(libraryDisplay),
      );
    } catch {}
  }, [libraryDisplay]);
  const input = useRef<HTMLInputElement>(null);
  const booksRef = useRef(books);
  booksRef.current = books;
  const [collections, setCollections] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("folio-collections") || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    let live = true;
    void loadMetrics().catch(() =>
      setError("Não foi possível iniciar as estatísticas."),
    );
    loadBooks()
      .then(async (stored) => {
        if (!stored.length && !localStorage.getItem("folio-initialized")) {
          try {
            const response = await fetch("./sample.epub");
            if (!response.ok) throw new Error("Livro de exemplo indisponível");
            const sample = await importEpub(
              new File(
                [await response.arrayBuffer()],
                "A arte de ler devagar.epub",
              ),
            );
            await saveBook(sample);
            stored = [sample];
            localStorage.setItem("folio-initialized", "1");
          } catch (e) {
            console.warn(e);
          }
        }
        if (live) {
          setBooks(stored);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (live) {
          setError(`Não foi possível abrir sua biblioteca: ${e.message}`);
          setLoading(false);
        }
      });
    window.folio
      ?.getSettings()
      .then((s) => live && setSettings(s))
      .catch((e) => setError(e.message))
;
    return () => {
      live = false;
    };
  }, []);
  const collectionsAll = useMemo(
    () => [
      ...new Set([
        ...collections,
        ...books.map((b) => b.collection).filter(Boolean),
      ]),
    ],
    [collections, books],
  );
  async function updateBook(book: BookRecord) {
    const previous = booksRef.current.find((b) => b.id === book.id);
    await saveBook(book);
    if (book.finished && previous && !previous.finished)
      await recordCompletion(book);
    setBooks((all) => all.map((b) => (b.id === book.id ? book : b)));
  }
  async function importFiles(files: File[]) {
    if (busy) return;
    setBusy(true);
    setError("");
    let added = 0;
    const existing = new Set(books.map((b) => b.id));
    const failures: string[] = [];
    for (const file of files) {
      try {
        const book = await importEpub(file);
        if (existing.has(book.id)) continue;
        existing.add(book.id);
        await saveBook(book);
        setBooks((all) => [book, ...all.filter((b) => b.id !== book.id)]);
        added++;
      } catch (e) {
        failures.push(`${file.name}: ${(e as Error).message}`);
      }
    }
    setBusy(false);
    if (failures.length) setError(failures.join("\n"));
    if (added) setView("library");
    return failures.length === 0;
  }
  useEffect(() => {
    const receive = (event: Event) => {
      const { name, data } = (
        event as CustomEvent<{ name: string; data: Uint8Array }>
      ).detail;
      const bytes = Uint8Array.from(data);
      void importFiles([
        new File([bytes.buffer], name, { type: "application/epub+zip" }),
      ]).catch((e) => setError(e.message));
    };
    window.addEventListener("folio-catalog-download", receive);
    return () => window.removeEventListener("folio-catalog-download", receive);
  }, [books, busy]);
  async function remove(book: BookRecord) {
    if (
      !window.confirm(`Remover “${book.title}” e suas notas desta biblioteca?`)
    )
      return;
    await deleteBook(book.id);
    setBooks((all) => all.filter((b) => b.id !== book.id));
    setMenu(null);
  }
  useEffect(() => {
    const back = (event: Event) => {
      if (modal) {
        event.preventDefault();
        setModal(null);
      } else if (active) {
        event.preventDefault();
        window.dispatchEvent(new Event("folio-close-reader"));
      } else if (moreOpen) {
        event.preventDefault();
        setMoreOpen(false);
      } else if (libraryOptions) {
        event.preventDefault();
        setLibraryOptions(false);
      } else if (view !== "library") {
        event.preventDefault();
        setView("library");
      }
    };
    window.addEventListener("folio-back", back);
    return () => window.removeEventListener("folio-back", back);
  }, [active, modal, view, moreOpen, libraryOptions]);
  const current = books.find((b) => b.id === active);
  const sorted = books
    .filter(
      (b) =>
        (view === "favorites"
          ? b.favorite
          : view.startsWith("collection:")
            ? b.collection === view.slice(11)
            : view === "finished"
              ? b.finished
              : true) &&
        `${b.title} ${b.author}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "author"
          ? a.author.localeCompare(b.author)
          : (b.lastOpened || b.added) - (a.lastOpened || a.added),
    );
  const latest = books
    .filter((b) => b.lastOpened && !b.finished)
    .sort((a, b) => b.lastOpened - a.lastOpened)[0];
  function openBook(b: BookRecord,target?:string) {
    const latestBook = booksRef.current.find(item => item.id === b.id) || b;
    void updateBook({
      ...latestBook,
      readingBaseline: latestBook.readingBaseline || {at: Date.now(), progress: latestBook.progress},
      lastOpened: Date.now(),
    }).then(() => {setInitialTarget(target);setActive(b.id);}).catch((e) => setError(e.message));
  }
  const addCollection = (value: string) => {
    const name = value.trim().slice(0, 80);
    if (name) {
      const next = [...new Set([...collections, name])];
      setCollections(next);
      localStorage.setItem("folio-collections", JSON.stringify(next));
      setModal(null);
      setView(`collection:${name}`);
    }
  };
  if (current)
    return (
      <Suspense fallback={<div className="empty-state">Abrindo o leitor…</div>}>
        <Reader
          appTheme={appTheme}
          book={current}
          libraryBooks={books}
          initialTarget={initialTarget}
          onUpdate={updateBook}
          onConceptMap={()=>setView("concepts")}
          onClose={() => setActive(null)}
          settingsModal={
            modal === "settings" ? (
              <SettingsModal
                settings={settings}
                      onSave={setSettings}
                onClose={() => setModal(null)}
              />
            ) : undefined
          }
        />
      </Suspense>
    );
  return (
    <div
      className={
        "app-shell" +
        (isBookView && libraryDisplay.minimal ? " library-minimal" : "")
      }
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void importFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <img src="./folio-ui.png" alt="" />
          </span>
          <span>
            folio livre<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="workspace-tag">
          <span className="status-dot" /> SUA BIBLIOTECA PESSOAL
        </div>
        <nav aria-label="Biblioteca">
          <button
            className={view === "statistics" ? "nav-item active" : "nav-item"}
            onClick={() => setView("statistics")}
          >
            <BarChart3 size={19} />
            Estatísticas
          </button>
          <button
            className={view === "library" ? "nav-item active" : "nav-item"}
            onClick={() => setView("library")}
          >
            <Library size={19} />
            Todos os livros<span>{books.length}</span>
          </button>
          <button
            className={view === "favorites" ? "nav-item active" : "nav-item"}
            onClick={() => setView("favorites")}
          >
            <Heart size={19} />
            Favoritos
          </button>
          <button
            className={view === "finished" ? "nav-item active" : "nav-item"}
            onClick={() => setView("finished")}
          >
            <Check size={19} />
            Concluídos
          </button>
          <button
            className={view === "notes" ? "nav-item active" : "nav-item"}
            onClick={() => setView("notes")}
          >
            <Highlighter size={19} />
            Destaques e notas
          </button>
        </nav>
        <button className={view==="concepts"?"nav-item active":"nav-item"} onClick={()=>setView("concepts")}><Network size={19}/>Mapa de ideias</button>
        <button className={view==="quotes"?"nav-item active":"nav-item"} onClick={()=>setView("quotes")}><Highlighter size={19}/>Trechos favoritos</button>
        <div className="sidebar-heading">
          COLEÇÕES
          <button
            aria-label="Criar coleção"
            onClick={() => setModal("collections")}
          >
            <Plus size={17} />
          </button>
        </div>
        <nav>
          {collectionsAll.map((c) => (
            <button
              key={c}
              onClick={() => setView(`collection:${c}`)}
              className={
                view === `collection:${c}` ? "nav-item active" : "nav-item"
              }
            >
              <Folder size={18} />
              {c}
              <span>{books.filter((b) => b.collection === c).length}</span>
            </button>
          ))}
          {!collectionsAll.length && (
            <button
              className="create-collection"
              onClick={() => setModal("collections")}
            >
              Organize suas próximas leituras
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="quiet-card">
            <BookOpen size={22} />
            <strong>Leia no seu ritmo</strong>
            <p>
              Importe seus EPUBs.
              <br />
              Leia, ouça e faça anotações.
            </p>
          </div>
          <button
            className={view === "discover" ? "nav-item active" : "nav-item"}
            onClick={() => setView("discover")}
          >
            <Compass size={19} />
            Descobrir livros
            <ArrowUpRight size={15} />
          </button>
          <button className="nav-item kindle-connect-button" onClick={() => setView("kindle")}><BookOpen size={19} />Conectar Kindle</button>
          <button className="nav-item" onClick={() => setModal("settings")}>
            <SettingsIcon size={19} />
            Preferências
          </button>
          <div className="offline-label">
            <span className="status-dot" /> Livros salvos neste dispositivo
          </div>
        </div>
      </aside>
      <nav className="mobile-navigation" aria-label="Navegação principal">
        <button
          onClick={() => setView("library")}
          aria-current={view === "library" ? "page" : undefined}
        >
          <Library size={20} />
          Biblioteca
        </button>
        <button
          onClick={() => setView("discover")}
          aria-label="Descobrir livros" aria-current={view === "discover" ? "page" : undefined}
        >
          <Compass size={20} />
          Buscar
        </button>
        <button
          onClick={() => setView("statistics")}
          aria-current={view === "statistics" ? "page" : undefined}
        >
          <BarChart3 size={20} />
          Estatísticas
        </button>
        <button onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen}>
          <MoreHorizontal size={20} />
          Mais
        </button>
      </nav>
      {moreOpen && (
        <div className="mobile-more" role="dialog" aria-label="Mais opções">
          <button
            onClick={() => {
              setView("favorites");
              setMoreOpen(false);
            }}
          >
            Favoritos
          </button>
          <button
            onClick={() => {
              setView("finished");
              setMoreOpen(false);
            }}
          >
            Concluídos
          </button>
          <button
            onClick={() => {
              setView("notes");
              setMoreOpen(false);
            }}
          >
            Destaques e notas
          </button>
          <button
            onClick={() => {
              setModal("settings");
              setMoreOpen(false);
            }}
          >
            Preferências
          </button>
          <button
            onClick={() => {
              setModal("collections");
              setMoreOpen(false);
            }}
          >
            Coleções
          </button>
          <button onClick={()=>{setView("concepts");setMoreOpen(false);}}>Mapa de ideias</button>
          <button onClick={()=>{setView("quotes");setMoreOpen(false);}}>Trechos favoritos</button>
          <button className="kindle-connect-button" onClick={() => {setView("kindle");setMoreOpen(false);}}>Conectar Kindle</button>
          <button onClick={() => setMoreOpen(false)}>Fechar</button>
        </div>
      )}
      <main className="main-library">
        <header className="topbar">
          {isBookView && libraryDisplay.minimal ? (
            <h2 className="minimal-library-title">
              {view === "favorites"
                ? "Favoritos"
                : view === "finished"
                  ? "Concluídos"
                  : view.startsWith("collection:")
                    ? view.slice(11)
                    : "Biblioteca"}
            </h2>
          ) : (
            <div className="breadcrumb">
              Minha biblioteca <ChevronRight size={14} />
              <span>
                {view === "kindle"
                  ? "Kindle"
                  : view === "discover"
                  ? "Descobrir"
                  : view === "concepts"
                  ? "Mapa de ideias"
                  : view === "quotes"
                    ? "Trechos favoritos"
                    : view === "notes"
                    ? "Notas"
                    : view === "statistics"
                      ? "Estatísticas"
                      : "Livros"}
              </span>
            </div>
          )}
          <div className="top-actions">
            <button className="icon-button quick-theme" aria-label={appTheme==="dark"?"Ativar modo claro":"Ativar modo escuro"} title={appTheme==="dark"?"Modo claro":"Modo escuro"} onClick={()=>setAppTheme(t=>t==="dark"?"light":"dark")}>{appTheme==="dark"?<Sun size={19}/>:<Moon size={19}/>}</button>
            {isBookView && (
              <>
                <button
                  className="icon-button"
                  aria-label="Visualização da biblioteca"
                  aria-expanded={libraryOptions}
                  onClick={() => setLibraryOptions(!libraryOptions)}
                >
                  <SlidersHorizontal size={19} />
                </button>
                {libraryDisplay.minimal && (
                  <button
                    className="icon-button"
                    aria-label="Adicionar EPUB"
                    onClick={() => input.current?.click()}
                    disabled={busy}
                  >
                    <Plus size={20} />
                  </button>
                )}
              </>
            )}
            {isBookView && libraryDisplay.minimal && (
              <label className="minimal-sort">
                <ArrowDownUp size={21} />
                <select
                  aria-label="Ordenar livros"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="recent">Mais recentes</option>
                  <option value="title">Título A–Z</option>
                  <option value="author">Autor A–Z</option>
                </select>
              </label>
            )}
            {isBookView && !libraryDisplay.minimal && (
              <button
                className="icon-button"
                aria-label={
                  libraryDisplay.compactHeader
                    ? "Expandir biblioteca"
                    : "Compactar biblioteca"
                }
                aria-pressed={libraryDisplay.compactHeader}
                onClick={() =>
                  setLibraryDisplay((d) => ({
                    ...d,
                    compactHeader: !d.compactHeader,
                    continueCollapsed: !d.compactHeader,
                  }))
                }
              >
                {libraryDisplay.compactHeader ? (
                  <Maximize2 size={18} />
                ) : (
                  <Minimize2 size={18} />
                )}
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Coleções"
              onClick={() => setModal("collections")}
            >
              <Folder size={18} />
            </button>
            <span className="open-source">OPEN SOURCE</span>
            <button
              className="icon-button"
              aria-label="Preferências"
              onClick={() => setModal("settings")}
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        </header>
        {isBookView && libraryOptions && (
          <section
            className="library-view-options"
            aria-label="Visualização da biblioteca"
          >
            <div className="library-mode-switch" role="group" aria-label="Modo da estante">
              <button aria-pressed={libraryDisplay.mode === "standard"} onClick={() => setLibraryDisplay(d => ({...d, mode: "standard"}))}><LayoutGrid size={18}/> Padrão</button>
              <button aria-pressed={libraryDisplay.mode === "shelf"} onClick={() => setLibraryDisplay(d => ({...d, mode: "shelf"}))}><Columns3 size={18}/> Prateleira</button>
            </div>
            <label>
              <input
                type="checkbox"
                checked={libraryDisplay.minimal}
                onChange={(event) =>
                  setLibraryDisplay((previous) => ({
                    ...previous,
                    minimal: event.target.checked,
                  }))
                }
              />
              Visual minimalista
            </label>
            <label>
              {libraryDisplay.mode === "shelf" ? "Tamanho dos livros" : "Tamanho das capas"}
              <input
                aria-label="Tamanho das capas"
                type="range"
                min="70"
                max="180"
                step="5"
                value={libraryDisplay.coverSize}
                onChange={(event) =>
                  setLibraryDisplay((previous) => ({
                    ...previous,
                    coverSize: Number(event.target.value),
                  }))
                }
              />
            </label>
            <button onClick={() => setLibraryOptions(false)}>Pronto</button>
          </section>
        )}
        <div
          style={
            {
              "--book-cover-size": `${libraryDisplay.coverSize}px`,
            } as React.CSSProperties
          }
          className={
            "library-content" +
            (isBookView && libraryDisplay.compactHeader
              ? " library-compact"
              : "")
          }
        >
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button aria-label="Fechar aviso" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {view === "concepts" ? (
            <Suspense fallback={<p>Abrindo mapa de ideias…</p>}><ConceptMap books={books} onOpen={openBook} onUpdate={updateBook}/></Suspense>
          ) : view === "quotes" ? (
            <Suspense fallback={<p>Abrindo seus trechos…</p>}><FavoritePassages books={books} onOpen={openBook}/></Suspense>
          ) : view === "kindle" ? (
            <Suspense fallback={<p>Preparando conexão…</p>}><KindleConnect books={books} onClose={() => setView("library")} /></Suspense>
          ) : view === "next" ? (
            <Suspense fallback={<p>Preparando sugestões…</p>}>
              <NextReads
                books={books}
                onOpen={openBook}
                onSearch={() => setView("discover")}
              />
            </Suspense>
          ) : view === "statistics" ? (
            <Suspense
              fallback={
                <div className="empty-state">Abrindo suas estatísticas…</div>
              }
            >
              <Statistics books={books} onOpen={openBook} />
            </Suspense>
          ) : view === "discover" ? (
            <Suspense
              fallback={<div className="empty-state">Abrindo o catálogo…</div>}
            >
              <Catalog
                settings={settings}
                initialQuery={catalogQuery}
                      onDownload={() => setModal("download")}
                onImport={importFiles}
                books={books}
              />
            </Suspense>
          ) : view === "notes" ? (
            <>
              <div className="section-heading">
                <div>
                  <div className="eyebrow">IDEIAS QUE FICAM</div>
                  <h1>
                    Destaques e notas<span>.</span>
                  </h1>
                  <p>Suas descobertas, reunidas em um só lugar.</p>
                </div>
              </div>
              <div className="notes-library">
                {books.flatMap((b) =>
                  b.annotations.map((a) => (
                    <button
                      className="note-card"
                      key={a.id}
                      onClick={() => openBook(b, a.cfi)}
                    >
                      <span>
                        {b.title} · {a.chapter}
                      </span>
                      <blockquote>{a.text}</blockquote>
                      {a.note && <p>{a.note}</p>}
                      <small>
                        {new Date(a.created).toLocaleDateString("pt-BR")}
                      </small>
                    </button>
                  )),
                )}
                {!books.some((b) => b.annotations.length) && (
                  <Empty
                    title="Guarde o que importa"
                    text="Selecione um trecho durante a leitura para destacar e acrescentar uma nota."
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="section-heading">
                <div>
                  <div className="eyebrow">UM ESPAÇO PARA SUAS IDEIAS</div>
                  <h1>
                    {view === "favorites"
                      ? "Seus favoritos"
                      : view === "finished"
                        ? "Leituras concluídas"
                        : view.startsWith("collection:")
                          ? view.slice(11)
                          : "Sua biblioteca"}
                    <span>.</span>
                  </h1>
                  <p>Boas histórias merecem um lugar só seu.</p>
                </div>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  <Plus size={18} />
                  {busy ? "Importando…" : "Adicionar EPUB"}
                </button>
              </div>
              {latest && view === "library" && !query && (
                <section
                  className={
                    "continue-card" +
                    (libraryDisplay.continueCollapsed ? " is-compact" : "")
                  }
                >
                  <button
                    className="icon-button continue-size-toggle"
                    aria-label={
                      libraryDisplay.continueCollapsed
                        ? "Expandir cartão de leitura"
                        : "Recolher cartão de leitura"
                    }
                    aria-expanded={!libraryDisplay.continueCollapsed}
                    aria-controls="continue-reading-copy"
                    onClick={() =>
                      setLibraryDisplay((d) => ({
                        ...d,
                        continueCollapsed: !d.continueCollapsed,
                      }))
                    }
                  >
                    {libraryDisplay.continueCollapsed ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronUp size={18} />
                    )}
                  </button>
                  <div className="continue-copy" id="continue-reading-copy">
                    <div className="eyebrow">CONTINUE DE ONDE PAROU</div>
                    <h2>{latest.title}</h2>
                    <p>{latest.author}</p>
                    <div className="progress-row">
                      <div className="progress-track">
                        <span style={{ width: `${latest.progress * 100}%` }} />
                      </div>
                      <span>{Math.round(latest.progress * 100)}% lido</span>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => openBook(latest)}
                    >
                      Voltar à leitura <ArrowUpRight size={17} />
                    </button>
                  </div>
                  <div className="continue-decoration">
                    <BookOpen size={80} strokeWidth={0.8} />
                    <span>
                      um capítulo
                      <br />
                      de cada vez.
                    </span>
                  </div>
                </section>
              )}
              <div className="library-mode-bar" role="group" aria-label="Modo da estante">
                <button aria-label="Modo padrão" title="Padrão" aria-pressed={libraryDisplay.mode === "standard"} onClick={() => setLibraryDisplay(d => ({...d, mode: "standard"}))}><LayoutGrid size={18}/></button>
                <button aria-label="Modo prateleira" title="Prateleira" aria-pressed={libraryDisplay.mode === "shelf"} onClick={() => setLibraryDisplay(d => ({...d, mode: "shelf"}))}><Columns3 size={18}/></button>
              </div>
              <div className="library-tools">
                <div className="library-tabs">
                  <button className="selected">
                    {view === "favorites"
                      ? "Favoritos"
                      : view === "finished"
                        ? "Concluídos"
                        : "Todos os livros"}{" "}
                    <span>{sorted.length}</span>
                  </button>
                  <button onClick={() => setView("discover")}>
                    Explorar <ArrowUpRight size={13} />
                  </button>
                </div>
                <div className="filter-tools">
                  <label className="search-input">
                    <Search size={17} />
                    <input
                      placeholder="Buscar título ou autor"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Ordenar livros"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="recent">Mais recentes</option>
                    <option value="title">Título A–Z</option>
                    <option value="author">Autor A–Z</option>
                  </select>
                </div>
              </div>
              {loading ? (
                <div className="empty-state">Abrindo sua biblioteca…</div>
              ) : (
                <div className={"book-grid" + (libraryDisplay.mode === "shelf" && sorted.length ? " bookshelf" : "")} aria-label={libraryDisplay.mode === "shelf" ? "Prateleira de livros" : "Livros"}>
                  {sorted.map((book, i) => (
                    <article key={book.id} className="book-card" data-cover-colors={coverColors.has(book.cover || "") ? "ready" : "fallback"} style={libraryDisplay.mode === "shelf" ? spineStyle(book.id, coverColors.get(book.cover || "")) : undefined}>
                      <button
                        className={`book-cover color-${i % 5}`}
                        onClick={() => openBook(book)}
                        aria-label={`Ler ${book.title}`}
                        title={`${book.title} — ${book.author}`}
                      >
                        {book.cover ? (
                          <img src={book.cover} alt={`Capa de ${book.title}`} />
                        ) : (
                          <div className="generated-cover">
                            <small>{book.author}</small>
                            <strong>{book.title}</strong>
                            <span>FOLIO · EPUB</span>
                          </div>
                        )}
                        {libraryDisplay.mode === "shelf" && <span className="book-spine" aria-hidden="true"><strong>{book.title}</strong><small>{book.author}</small></span>}
                        {book.finished && (
                          <span className="finished-badge">
                            <Check size={13} /> Concluído
                          </span>
                        )}
                        <span className="cover-hover">
                          <BookOpen size={19} /> Abrir livro
                        </span>
                      </button>
                      <div className="book-meta">
                        <div>
                          <h3>
                            <button onClick={() => openBook(book)}>
                              {book.title}
                            </button>
                          </h3>
                          <p>{book.author}</p>
                        </div>
                        <div className="book-menu-container">
                          <button
                            className="icon-button"
                            aria-label={`Opções de ${book.title}`}
                            onClick={() =>
                              setMenu(menu === book.id ? null : book.id)
                            }
                          >
                            <MoreHorizontal size={19} />
                          </button>
                          {menu === book.id && (
                            <div className="book-menu">
                              <button
                                onClick={() => {
                                  void updateBook({
                                    ...book,
                                    favorite: !book.favorite,
                                  });
                                  setMenu(null);
                                }}
                              >
                                <Heart size={14} />
                                {book.favorite
                                  ? "Remover favorito"
                                  : "Favoritar"}
                              </button>
                              <button
                                onClick={() => {
                                  void updateBook({
                                    ...book,
                                    finished: !book.finished,
                                  });
                                  setMenu(null);
                                }}
                              >
                                <Check size={14} />
                                {book.finished
                                  ? "Marcar não lido"
                                  : "Marcar concluído"}
                              </button>
                              <label>
                                Coleção
                                <select
                                  value={book.collection}
                                  onChange={(e) => {
                                    void updateBook({
                                      ...book,
                                      collection: e.target.value,
                                    });
                                    setMenu(null);
                                  }}
                                >
                                  <option value="">Sem coleção</option>
                                  {collectionsAll.map((c) => (
                                    <option key={c}>{c}</option>
                                  ))}
                                </select>
                              </label>
                              <button
                                className="danger-text"
                                onClick={() => void remove(book)}
                              >
                                <Trash2 size={14} />
                                Remover livro
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="book-status">
                        {book.favorite && (
                          <Heart size={12} fill="currentColor" />
                        )}
                        {book.lastOpened ? (
                          <>
                            <div className="progress-track">
                              <span
                                style={{ width: `${book.progress * 100}%` }}
                              />
                            </div>
                            <span>{Math.round(book.progress * 100)}%</span>
                          </>
                        ) : (
                          <span className="new-book">Pronto para começar</span>
                        )}
                      </div>
                    </article>
                  ))}
                  {!sorted.length && (
                    <Empty
                      title={
                        query
                          ? "Nenhum livro encontrado"
                          : "Sua próxima história começa aqui"
                      }
                      text={
                        query
                          ? "Experimente outro título ou autor."
                          : "Importe um EPUB ou arraste seus livros para esta janela."
                      }
                    />
                  )}
                  <button
                    className="add-book-card"
                    onClick={() => input.current?.click()}
                    disabled={busy}
                  >
                    <span>
                      <Plus size={26} />
                    </span>
                    <strong>Um novo capítulo</strong>
                    <p>Importe seus arquivos EPUB</p>
                  </button>
                </div>
              )}
              <footer className="library-footer">
                <span>
                  <BookOpen size={14} /> Feito para ler, pensar e descobrir.
                </span>
                <span>Folio Livre · v1.0.1</span>
              </footer>
            </>
          )}
        </div>
      </main>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept=".epub,application/epub+zip"
        onChange={(e) => {
          void importFiles(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      {drag && (
        <div className="drop-overlay">
          <BookOpen size={50} />
          <h2>Solte seus EPUBs aqui</h2>
        </div>
      )}
      {modal === "settings" && (
        <SettingsModal
                settings={settings}
          onSave={setSettings}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "download" && (
        <DownloadModal onClose={() => setModal(null)} onImport={importFiles} />
      )}
      {modal === "collections" && (
        <CollectionModal
          onClose={() => setModal(null)}
          onCreate={addCollection}
          names={collectionsAll}
          onSelect={(name) => {
            setView(`collection:${name}`);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <BookOpen size={32} strokeWidth={1} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusable = element.current?.querySelector<HTMLElement>(
      "input,button,select,textarea",
    );
    focusable?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={element}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
          if (e.key === "Tab") {
            const nodes = Array.from(
              element.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
              ) || [],
            );
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function CollectionModal({
  onCreate,
  onClose,
  names,
  onSelect,
}: {
  onCreate: (n: string) => void;
  onClose: () => void;
  names: string[];
  onSelect: (n: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <Modal title="Coleções" onClose={onClose}>
      <div className="collection-choices">
        {names.map((name) => (
          <button key={name} onClick={() => onSelect(name)}>
            <Folder size={16} />
            {name}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(name);
        }}
      >
        <label className="form-field">
          Nome da coleção
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Literatura, estudos, próximas leituras…"
            maxLength={80}
          />
        </label>
        <button className="primary-button" disabled={!name.trim()}>
          Criar coleção
        </button>
      </form>
    </Modal>
  );
}
function SettingsModal({settings,onSave,onClose}:{settings:Settings;onSave:(s:Settings)=>void;onClose:()=>void}) {
  const [anna,setAnna]=useState(settings.annaUrl);
  const [appearance,setAppearance]=useState(document.documentElement.dataset.theme||"dark");
  const [saving,setSaving]=useState(false),[error,setError]=useState("");
  return <Modal title="Preferências" onClose={onClose}><form onSubmit={async e=>{
    e.preventDefault();setSaving(true);setError("");
    try {
      const url=new URL(anna);
      if(url.protocol!=="https:"||url.username||url.password)throw Error("Use um endereço HTTPS sem dados de acesso.");
      url.pathname="/";url.search="";url.hash="";
      const value=window.folio?await window.folio.saveSettings({annaUrl:url.href}):{...settings,annaUrl:url.href};
      localStorage.setItem("folio:anna-url",value.annaUrl);onSave(value);onClose();
    }catch(e){setError((e as Error).message);}finally{setSaving(false);}
  }}>
    <label className="form-field">Tema do aplicativo<select aria-label="Tema do aplicativo" value={appearance} onChange={e=>{setAppearance(e.target.value);window.dispatchEvent(new CustomEvent("folio-theme-change",{detail:e.target.value}));}}><option value="light">Claro</option><option value="dark">Escuro</option></select></label>
    <label className="form-field">Endereço do Anna’s Archive<input aria-label="Endereço do Anna’s Archive" type="url" required value={anna} onChange={e=>setAnna(e.target.value)}/><small>Atualize se o site mudar de domínio. A busca usa os links gratuitos.</small></label>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={saving}>{saving?"Salvando…":"Salvar preferências"}</button>
  </form></Modal>;
}
function DownloadModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (f: File[]) => Promise<boolean | undefined>;
}) {
  const [url, setUrl] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title="Importar EPUB por link" onClose={onClose}>
      <p className="modal-description">
        Cole o endereço HTTPS direto do arquivo EPUB que você pode baixar.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (!window.folio)
              throw new Error(
                "A importação por link está disponível no aplicativo Folio.",
              );
            const result = await window.folio.download(url);
            const bytes = Uint8Array.from(result.data);
            const ok = await onImport([
              new File([bytes.buffer], result.name, {
                type: "application/epub+zip",
              }),
            ]);
            if (ok === false)
              throw new Error(
                "O arquivo recebido não pôde ser importado. Confira o aviso na biblioteca.",
              );
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="form-field">
          Link do arquivo
          <input
            type="url"
            required
            placeholder="https://…/livro.epub"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy}>
          {busy ? "Baixando e importando…" : "Importar livro"}
          <Download size={16} />
        </button>
      </form>
    </Modal>
  );
}

// Stable bindings: sorting or filtering never changes a book's appearance.
function spineStyle(id: string, colors?: CoverColors): React.CSSProperties {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (Math.imul(hash, 31) + id.charCodeAt(i)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  return {"--spine-color": colors?.background || "#b9ac94", "--spine-accent": colors?.accent || "#776b55", "--spine-ink": colors?.ink || "#24211d", "--spine-height": `${88 + (hash >>> 4) % 13}%`} as React.CSSProperties;
}
