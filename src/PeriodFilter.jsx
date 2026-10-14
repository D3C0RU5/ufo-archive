import React, { useEffect, useRef, useState } from 'react'
import { buildBoundary } from './dateFilter.js'

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function dateParts(date, isEnd) {
  if (!date) return { year: '', month: '', day: '' }
  const [year, month, day] = date.split('-')
  if (month === (isEnd ? '12' : '01') && day === (isEnd ? '31' : '01')) return { year, month: '', day: '' }
  const monthLastDay = String(new Date(Number(year), Number(month), 0).getDate()).padStart(2, '0')
  if (day === (isEnd ? monthLastDay : '01')) return { year, month, day: '' }
  return { year, month, day }
}

function formatBoundary(date, isEnd) {
  const { year, month, day } = dateParts(date, isEnd)
  if (!month) return year
  if (!day) return `${months[Number(month) - 1].slice(0, 3).toLowerCase()} ${year}`
  return `${day}/${month}/${year}`
}

function DateFields({ label, value, onChange, minYear, maxYear }) {
  const daysInMonth = value.year && value.month
    ? new Date(Number(value.year), Number(value.month), 0).getDate()
    : 31

  return (
    <div className="period-picker__date-group" role="group" aria-label={label}>
      <span className="period-picker__date-label mono">{label}</span>
      <div className="period-picker__date-fields">
        <label>
          <span className="sr-only">{label}: ano</span>
          <select aria-label={`${label}: ano`} value={value.year} onChange={(event) => onChange({ year: event.target.value, month: '', day: '' })}>
            <option value="">Ano</option>
            {Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index).map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">{label}: mês</span>
          <select aria-label={`${label}: mês`} value={value.month} disabled={!value.year} onChange={(event) => onChange({ ...value, month: event.target.value, day: '' })}>
            <option value="">Mês</option>
            {months.map((month, index) => <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">{label}: dia</span>
          <select aria-label={`${label}: dia`} value={Number(value.day) > daysInMonth ? '' : value.day} disabled={!value.month} onChange={(event) => onChange({ ...value, day: event.target.value })}>
            <option value="">Dia</option>
            {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => <option key={day} value={String(day).padStart(2, '0')}>{day}</option>)}
          </select>
        </label>
      </div>
    </div>
  )
}

export default function PeriodFilter({ value, onChange, sightings, count }) {
  const [open, setOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [draft, setDraft] = useState({ from: dateParts(value.from, false), to: dateParts(value.to, true) })
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const minYear = Math.min(...sightings.map(({ startDate }) => Number(startDate.slice(0, 4))))
  const maxYear = Math.max(...sightings.map(({ endDate }) => Number(endDate.slice(0, 4))))
  const presets = [...sightings]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map(({ id, startDate, endDate }) => {
      const firstYear = startDate.slice(0, 4)
      const lastYear = endDate.slice(0, 4)
      return { id, label: firstYear === lastYear ? firstYear : `${firstYear}–${lastYear}`, from: `${firstYear}-01-01`, to: `${lastYear}-12-31` }
    })
    .filter((preset, index, all) => all.findIndex(({ from, to }) => from === preset.from && to === preset.to) === index)
  const selectedPreset = presets.find(({ from, to }) => from === value.from && to === value.to)
  const startLabel = value.from ? formatBoundary(value.from, false) : ''
  const endLabel = value.to ? formatBoundary(value.to, true) : ''
  const label = selectedPreset?.label || (
    !value.from && !value.to ? 'Todos os períodos'
      : value.from && value.to
        ? startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`
        : value.from ? `Desde ${startLabel}` : `Até ${endLabel}`
  )
  const from = buildBoundary(draft.from, false)
  const to = buildBoundary(draft.to, true)
  const invalidRange = Boolean(from && to && from > to)

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function toggle() {
    if (!open) {
      setDraft({ from: dateParts(value.from, false), to: dateParts(value.to, true) })
      setShowCustom(Boolean((value.from || value.to) && !selectedPreset))
    }
    setOpen(!open)
  }

  function selectRange(next) {
    onChange(next)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className="period-picker" ref={rootRef}>
      <button ref={triggerRef} className={`period-picker__trigger ${value.from || value.to ? 'period-picker__trigger--active' : ''}`} type="button" aria-expanded={open} aria-controls="period-picker-panel" onClick={toggle}>
        <span className="period-picker__trigger-icon" aria-hidden="true">◷</span>
        <span className="period-picker__trigger-title mono">PERÍODO</span>
        <span className="period-picker__trigger-value">{label}</span>
        <span className="period-picker__trigger-chevron" aria-hidden="true">⌄</span>
      </button>
      <output className="sr-only" aria-live="polite">{count} {count === 1 ? 'relato' : 'relatos'} no período</output>
      {open && (
        <div className="period-picker__panel" id="period-picker-panel">
          <p className="period-picker__heading mono">PERÍODOS COM RELATOS</p>
          <div className="period-picker__presets">
            <button type="button" className={!value.from && !value.to ? 'period-picker__preset period-picker__preset--active' : 'period-picker__preset'} onClick={() => selectRange({ from: '', to: '' })}>Todos</button>
            {presets.map(({ id, label: presetLabel, from: presetFrom, to: presetTo }) => (
              <button key={id} type="button" className={value.from === presetFrom && value.to === presetTo ? 'period-picker__preset period-picker__preset--active' : 'period-picker__preset'} onClick={() => selectRange({ from: presetFrom, to: presetTo })}>{presetLabel}</button>
            ))}
          </div>
          <button className="period-picker__custom-toggle" type="button" aria-expanded={showCustom} onClick={() => setShowCustom(!showCustom)}>
            <span>Intervalo personalizado</span><span aria-hidden="true">{showCustom ? '−' : '+'}</span>
          </button>
          {showCustom && (
            <div className="period-picker__custom">
              <p>Escolha o ano. Mês e dia são opcionais.</p>
              <DateFields label="De" value={draft.from} onChange={(next) => setDraft((current) => ({ ...current, from: next }))} minYear={minYear} maxYear={maxYear} />
              <DateFields label="Até" value={draft.to} onChange={(next) => setDraft((current) => ({ ...current, to: next }))} minYear={minYear} maxYear={maxYear} />
              {invalidRange && <p className="period-picker__error" role="alert">A data final deve ser igual ou posterior à inicial.</p>}
              <div className="period-picker__actions">
                <button type="button" onClick={() => setOpen(false)}>Cancelar</button>
                <button type="button" className="period-picker__apply" disabled={invalidRange} onClick={() => selectRange({ from, to })}>Aplicar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
