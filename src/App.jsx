import React, { useState } from 'react'
import EarthGlobe from './EarthGlobe.jsx'

const records = [
  {
    id: '001',
    type: 'Sinal',
    title: 'O primeiro contato é uma pergunta.',
    description: 'Um convite para observar padrões, perspectivas e o que ainda não sabemos nomear.',
    meta: 'OBSERVAÇÃO / 01',
    visual: 'signal',
  },
  {
    id: '002',
    type: 'Imagem',
    title: 'Há mais do que os olhos alcançam.',
    description: 'Luz, sombra e distância transformam a maneira como percebemos o desconhecido.',
    meta: 'OBSERVAÇÃO / 02',
    visual: 'planet',
  },
  {
    id: '003',
    type: 'Nota',
    title: 'Toda descoberta começa aqui.',
    description: 'Um arquivo aberto para a curiosidade, organizado para uma exploração mais clara.',
    meta: 'OBSERVAÇÃO / 03',
    visual: 'grid',
  },
]

const filters = ['Todos', 'Sinal', 'Imagem', 'Nota']

function OrbitMark({ small = false }) {
  return (
    <span className={`orbit-mark ${small ? 'orbit-mark--small' : ''}`} aria-hidden="true">
      <span className="orbit-mark__core" />
    </span>
  )
}

function ArrowIcon({ diagonal = false }) {
  return diagonal ? (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M3 12 12 3M4 3h8v8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M2.5 9h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header">
      <a className="brand" href="#inicio" onClick={closeMenu} aria-label="Orbital, voltar ao início">
        <OrbitMark />
        <span className="brand__name">ORBITAL<span className="brand__dot">.</span></span>
        <span className="brand__divider" />
        <span className="brand__descriptor">ARQUIVO DE OBSERVAÇÃO</span>
      </a>

      <button
        className="menu-toggle"
        type="button"
        aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
      </button>

      <nav className={`nav ${menuOpen ? 'nav--open' : ''}`} aria-label="Navegação principal">
        <a href="#inicio" onClick={closeMenu}>Início</a>
        <a href="#registros" onClick={closeMenu}>Registros</a>
        <a href="#sobre" onClick={closeMenu}>Sobre</a>
        <a className="nav__access" href="#registros" onClick={closeMenu}>
          Explorar arquivo <ArrowIcon diagonal />
        </a>
      </nav>
    </header>
  )
}

function Hero() {
  return (
    <section className="hero" id="inicio" aria-labelledby="hero-title">
      <div className="hero__topline mono">
        <span><span className="live-dot" /> SISTEMA DE OBSERVAÇÃO ATIVO</span>
        <span className="hero__topline-right">COORD. 00° 00′ 00″ / ORIGEM: TERRA</span>
      </div>

      <div className="hero__stage">
        <div className="hero__copy">
          <p className="eyebrow"><span className="eyebrow__line" /> ARQUIVO 001 — O PONTO DE PARTIDA</p>
          <h1 id="hero-title">O universo<br />começa <em>aqui.</em></h1>
          <p className="hero__description">Uma nova perspectiva sobre tudo aquilo que ainda não conseguimos explicar.</p>
          <a className="primary-button" href="#registros">Explorar registros <ArrowIcon /></a>
        </div>

        <div className="planet-scene">
          <div className="planet-scene__orbit planet-scene__orbit--one" />
          <div className="planet-scene__orbit planet-scene__orbit--two" />
          <EarthGlobe />
          <span className="planet-scene__cross planet-scene__cross--top" aria-hidden="true">+</span>
          <span className="planet-scene__cross planet-scene__cross--bottom" aria-hidden="true">+</span>
        </div>

        <div className="hero__side-note mono">
          <span className="hero__side-rule" />
          <span>OLHE PARA CIMA.<br />PENSE ALÉM.</span>
          <span className="hero__side-index">01 / 03</span>
        </div>
      </div>

      <div className="hero__bottomline mono">
        <span>UM PROJETO VISUAL SOBRE O DESCONHECIDO</span>
        <a href="#registros">DESÇA PARA EXPLORAR <span aria-hidden="true">↓</span></a>
      </div>
    </section>
  )
}

function Records() {
  const [activeFilter, setActiveFilter] = useState('Todos')
  const visibleRecords = activeFilter === 'Todos'
    ? records
    : records.filter((record) => record.type === activeFilter)

  return (
    <section className="records section-shell" id="registros" aria-labelledby="records-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow"><span className="eyebrow__line" /> 02 / ACERVO</p>
          <h2 id="records-title">O que vemos.<br /><em>O que imaginamos.</em></h2>
        </div>
        <p>Três fragmentos conceituais para explorar as possibilidades além do horizonte.</p>
      </div>

      <div className="filter-bar" aria-label="Filtrar registros">
        <span className="filter-bar__label mono">FILTRAR POR TIPO</span>
        <div className="filter-bar__options">
          {filters.map((filter) => (
            <button
              key={filter}
              className={`filter-button ${activeFilter === filter ? 'filter-button--active' : ''}`}
              type="button"
              aria-pressed={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        <span className="filter-bar__count mono">{String(visibleRecords.length).padStart(2, '0')} ITENS</span>
      </div>

      <div className="record-grid">
        {visibleRecords.map((record) => (
          <article className="record-card" key={record.id}>
            <div className={`record-card__visual record-card__visual--${record.visual}`} aria-hidden="true">
              {record.visual === 'signal' && <span className="signal-shape"><i /><i /><i /></span>}
              {record.visual === 'planet' && <img src="/planet.webp" alt="" loading="lazy" />}
              {record.visual === 'grid' && <span className="grid-shape"><i /><i /><i /><i /></span>}
              <span className="record-card__visual-id mono">ORBITAL / {record.id}</span>
            </div>
            <div className="record-card__content">
              <div className="record-card__meta mono"><span>{record.meta}</span><span>{record.type.toUpperCase()}</span></div>
              <h3>{record.title}</h3>
              <p>{record.description}</p>
              <span className="record-card__arrow" aria-hidden="true"><ArrowIcon diagonal /></span>
            </div>
          </article>
        ))}
      </div>
      <p className="records__footnote mono">* CONTEÚDO CONCEITUAL PARA DEMONSTRAÇÃO DO DESIGN SYSTEM.</p>
    </section>
  )
}

function About() {
  return (
    <section className="about section-shell" id="sobre" aria-labelledby="about-title">
      <div className="about__mark"><OrbitMark /></div>
      <div className="about__content">
        <p className="eyebrow"><span className="eyebrow__line" /> 03 / SOBRE O PROJETO</p>
        <h2 id="about-title">A curiosidade é o nosso<br /><em>ponto de partida.</em></h2>
        <p>Orbital é um estudo visual inspirado na linguagem de arquivos públicos e exploração espacial. Criado para transformar informação em uma experiência clara, envolvente e aberta a novas perguntas.</p>
        <a href="#inicio" className="text-link">Voltar ao início <span aria-hidden="true">↑</span></a>
      </div>
      <span className="about__coords mono">ORIGEM / PLANETA TERRA<br />STATUS / EM OBSERVAÇÃO</span>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer section-shell">
      <div className="footer__brand"><OrbitMark small /> <span>ORBITAL.</span></div>
      <span className="mono">PROJETO CONCEITUAL INDEPENDENTE / 2026</span>
      <a href="#inicio" className="mono">VOLTAR AO TOPO ↑</a>
    </footer>
  )
}

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Records />
        <About />
      </main>
      <Footer />
    </>
  )
}
