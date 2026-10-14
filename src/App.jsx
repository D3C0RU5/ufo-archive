import React, { useEffect, useRef, useState } from 'react'
import EarthGlobe from './EarthGlobe.jsx'
import { sightings } from './sightings.js'
import { filterSightings } from './dateFilter.js'
import PeriodFilter from './PeriodFilter.jsx'

function OrbitMark() {
  return (
    <span className="orbit-mark" aria-hidden="true">
      <span className="orbit-mark__core" />
    </span>
  )
}

export default function App() {
  const [selectedId, setSelectedId] = useState(null)
  const [imageIndex, setImageIndex] = useState(0)
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const detailRef = useRef(null)
  const panelRef = useRef(null)
  const visibleSightings = filterSightings(sightings, dateRange)
  const selected = visibleSightings.find(({ id }) => id === selectedId)
  const selectedImage = selected?.images[imageIndex]

  function selectSighting(id) {
    setSelectedId(id)
    setImageIndex(0)
  }

  function changeDateRange(nextFilter) {
    const nextSightings = filterSightings(sightings, nextFilter)
    setDateRange(nextFilter)
    setSelectedId((id) => nextSightings.some((sighting) => sighting.id === id) ? id : null)
    setImageIndex(0)
  }

  useEffect(() => {
    if (selectedId && window.matchMedia('(max-width: 760px)').matches) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (selectedId) {
      panelRef.current?.scrollTo({ top: 0 })
    }
  }, [selectedId])

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Orbital, voltar ao início">
          <OrbitMark />
          <span className="brand__name">ORBITAL<span className="brand__dot">.</span></span>
        </a>
        <span className="site-header__context mono">ARQUIVO DE AVISTAMENTOS</span>
        <span className="site-header__count mono">{String(sightings.length).padStart(2, '0')} RELATOS</span>
      </header>

      <main className="explorer" id="inicio">
        <section className="explorer__map" aria-labelledby="map-title">
          <h1 className="sr-only" id="map-title">Mapa de avistamentos</h1>
          <PeriodFilter value={dateRange} onChange={changeDateRange} sightings={sightings} count={visibleSightings.length} />
          <div className="planet-scene">
            <span className="planet-scene__orbit planet-scene__orbit--one" aria-hidden="true" />
            <span className="planet-scene__orbit planet-scene__orbit--two" aria-hidden="true" />
            <EarthGlobe selectedSightingId={selected?.id ?? null} visibleSightings={visibleSightings} onSelectSighting={selectSighting} />
          </div>
          <p className="explorer__map-note mono">PONTOS APROXIMADOS · POSIÇÃO POR IP APROXIMADA · ARRASTE O GLOBO PARA EXPLORAR</p>
        </section>

        <aside className="explorer__panel" ref={panelRef} aria-labelledby="panel-title">
          <div className="explorer__panel-heading">
            <p className="eyebrow">ARQUIVO / RELATOS</p>
            <h2 id="panel-title">Explore os casos</h2>
            <p>Selecione um relato no mapa ou na lista.</p>
          </div>

          <div className="sighting-list" aria-label="Relatos disponíveis">
            {visibleSightings.map((sighting, index) => (
              <button
                key={sighting.id}
                className={`sighting-list__item ${selectedId === sighting.id ? 'sighting-list__item--active' : ''}`}
                type="button"
                aria-label={`Selecionar ${sighting.title}, ${sighting.location}`}
                aria-pressed={selectedId === sighting.id}
                onClick={() => selectSighting(sighting.id)}
              >
                <span className="sighting-list__number mono">{String(index + 1).padStart(2, '0')}</span>
                <span className="sighting-list__text">
                  <strong>{sighting.mapLabel}</strong>
                </span>
                <span className="sighting-list__arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>

          {visibleSightings.length === 0 && <p className="sighting-list__none">Nenhum relato neste intervalo. Escolha outro período ou selecione Todos.</p>}

          {selected ? (
            <article className="sighting-detail" ref={detailRef} aria-live="polite">
              <div className="sighting-detail__heading">
                <span className="sighting-detail__date mono">{selected.date}</span>
                <h3>{selected.title}</h3>
                <p className="sighting-detail__location">{selected.location}</p>
              </div>
              <p className="sighting-detail__description">{selected.description}</p>
              <div className="sighting-gallery" aria-label={`Imagens relacionadas a ${selected.title}`}>
                <a className={`sighting-gallery__main ${selectedImage.kind === 'photo' ? 'sighting-gallery__main--photo' : ''}`} href={selectedImage.src} target="_blank" rel="noopener noreferrer" aria-label={`Ampliar imagem: ${selectedImage.caption}`}>
                  <img src={selectedImage.src} alt={selectedImage.alt} />
                  <span className="sighting-gallery__zoom mono">AMPLIAR ↗</span>
                </a>
                <div className="sighting-gallery__caption">
                  <span>{selectedImage.caption}</span>
                  <a href={selectedImage.creditUrl} target="_blank" rel="noopener noreferrer">{selectedImage.credit} ↗</a>
                </div>
                {selected.images.length > 1 && (
                  <div className="sighting-gallery__thumbs" aria-label="Escolher imagem">
                    {selected.images.map((galleryImage, index) => (
                      <button
                        key={galleryImage.src}
                        className={imageIndex === index ? 'sighting-gallery__thumb--active' : ''}
                        type="button"
                        aria-label={`Imagem ${index + 1}: ${galleryImage.caption}`}
                        aria-pressed={imageIndex === index}
                        onClick={() => setImageIndex(index)}
                      >
                        <img src={galleryImage.src} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <a className="sighting-detail__source mono" href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">ABRIR FONTE DO RELATO ↗</a>
            </article>
          ) : visibleSightings.length > 0 ? (
            <div className="sighting-empty" aria-hidden="true">
              <span>◎</span>
              <p>Escolha um ponto para ver o relato e as imagens aqui.</p>
            </div>
          ) : null}
        </aside>
      </main>

      <footer className="site-footer mono">
        <span>ORBITAL / ARQUIVO DE OBSERVAÇÃO</span>
        <span>LOCALIZAÇÕES APROXIMADAS · IMAGENS IDENTIFICADAS PELA FONTE</span>
      </footer>
    </>
  )
}
