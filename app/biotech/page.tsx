'use client';

import { useEffect, useState, useCallback } from 'react';
import Navbar from '@/components/Navbar';

// ─── Types ───────────────────────────────────────────────────

interface BiotechEvent {
  _id: string;
  symbol: string;
  companyName: string;
  filingDate: string;
  therapyType: string;
  therapyEmoji: string;
  diseaseIndication: string;
  clinicalPhase: string;
  eventResult: string;
  eventResultEmoji: string;
  eventResultLabel: string;
  summary: string;
  docUrl?: string;
}

interface Milestone {
  _id: string;
  symbol: string;
  trialName?: string;
  primaryCompletionDate: string;
  phase?: string;
  condition?: string;
  nctId?: string;
}

type TabType = 'events' | 'milestones';

// ─── Helper ──────────────────────────────────────────────────

function daysFromNow(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function eventResultColor(result: string): string {
  switch (result) {
    case 'success':
    case 'approval':
      return '#22c55e'; // green
    case 'failure':
    case 'rejection':
      return '#cc1a22'; // red
    case 'mixed':
      return '#f59e0b'; // amber
    default:
      return '#9ca3af'; // gray
  }
}

// ─── Event Card ──────────────────────────────────────────────

function EventCard({ ev }: { ev: BiotechEvent }) {
  const resultColor = eventResultColor(ev.eventResult);

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
    }}>
      {/* Left: emoji */}
      <div style={{ fontSize: 36, minWidth: 44, textAlign: 'center', paddingTop: 2 }}>
        {ev.therapyEmoji}
      </div>

      {/* Right: content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: '#1a1a1a', fontFamily: 'Noto Serif TC, serif' }}>
            {ev.symbol}
          </span>
          <span style={{ color: '#555', fontSize: 13 }}>{ev.companyName}</span>
          <span style={{ marginLeft: 'auto', color: '#aaa', fontSize: 12, whiteSpace: 'nowrap' }}>
            {ev.filingDate}
          </span>
        </div>

        {/* Tags row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          <span style={{
            border: '1px solid #c9a84c',
            color: '#c9a84c',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 600,
          }}>
            {ev.therapyType}
          </span>
          <span style={{
            background: '#f3f4f6',
            color: '#555',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 12,
          }}>
            {ev.clinicalPhase}
          </span>
          <span style={{
            color: resultColor,
            fontWeight: 700,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            {ev.eventResultEmoji} {ev.eventResultLabel}
          </span>
        </div>

        {/* Summary */}
        <p style={{ fontSize: 14, color: '#444', lineHeight: 1.6, margin: '0 0 6px' }}>
          {ev.summary}
        </p>

        {/* Disease + link */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>
            {ev.diseaseIndication}
          </span>
          {ev.docUrl && (
            <a
              href={ev.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#cc1a22', textDecoration: 'none' }}
            >
              查看原文 →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Milestone Card ──────────────────────────────────────────

function MilestoneCard({ m }: { m: Milestone }) {
  const days = daysFromNow(m.primaryCompletionDate);

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '14px 18px',
      marginBottom: 10,
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
    }}>
      <div style={{
        background: days <= 30 ? '#fef3c7' : '#f3f4f6',
        color: days <= 30 ? '#92400e' : '#555',
        borderRadius: 8,
        padding: '6px 10px',
        fontWeight: 700,
        fontSize: 13,
        minWidth: 70,
        textAlign: 'center',
      }}>
        {days > 0 ? `${days}天後` : '已過期'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>
          {m.symbol}
          {m.phase && (
            <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: '#888' }}>
              {m.phase}
            </span>
          )}
        </div>
        {m.trialName && (
          <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{m.trialName}</div>
        )}
        {m.condition && (
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{m.condition}</div>
        )}
      </div>
      <div style={{ color: '#aaa', fontSize: 12, whiteSpace: 'nowrap' }}>
        {m.primaryCompletionDate}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────

export default function BiotechPage() {
  const [activeTab, setActiveTab] = useState<TabType>('events');
  const [events, setEvents] = useState<BiotechEvent[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [symbolFilter, setSymbolFilter] = useState('');

  const fetchEvents = useCallback(async (symbol?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50', page: '1' });
      if (symbol) params.set('symbol', symbol);
      const res = await fetch(`/api/biotech/events?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err) {
      console.error('fetchEvents error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMilestones = useCallback(async () => {
    try {
      const res = await fetch('/api/biotech/milestones');
      if (!res.ok) return;
      const data = await res.json();
      setMilestones(Array.isArray(data.milestones) ? data.milestones : []);
    } catch (err) {
      console.error('fetchMilestones error:', err);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchMilestones();
  }, [fetchEvents, fetchMilestones]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvents(symbolFilter.trim() || undefined);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f3f2', fontFamily: 'system-ui, sans-serif' }}>
      <Navbar />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 16px 60px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{
              fontFamily: 'Noto Serif TC, serif',
              fontSize: 26,
              fontWeight: 700,
              color: '#1a1a1a',
              margin: 0,
            }}>
              🧬 生技臨床事件追蹤
            </h1>
            <span style={{
              background: '#cc1a22',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 6,
              padding: '3px 8px',
              letterSpacing: 1,
            }}>
              MEMBER EXCLUSIVE
            </span>
          </div>
          <p style={{ color: '#666', fontSize: 14, margin: 0 }}>
            即時追蹤 JG 持股的 SEC 8-K 臨床試驗申報、FDA 決定與新藥進展
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {([
            { key: 'events', label: '📰 最新事件' },
            { key: 'milestones', label: '📅 即將到來' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '8px 18px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
                background: activeTab === key ? '#cc1a22' : '#e5e7eb',
                color: activeTab === key ? '#fff' : '#555',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div>
            {/* Search */}
            <form onSubmit={handleSearch} style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="篩選股票代號（例：MRNA）"
                value={symbolFilter}
                onChange={(e) => setSymbolFilter(e.target.value.toUpperCase())}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #d1d5db',
                  fontSize: 14,
                  outline: 'none',
                  maxWidth: 240,
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '8px 16px',
                  background: '#1a1a1a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                搜尋
              </button>
              {symbolFilter && (
                <button
                  type="button"
                  onClick={() => { setSymbolFilter(''); fetchEvents(); }}
                  style={{
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    color: '#555',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  清除
                </button>
              )}
            </form>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>載入中...</div>
            ) : events.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: 48,
                color: '#999',
                background: '#fff',
                borderRadius: 12,
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                <div>目前沒有符合條件的臨床事件</div>
              </div>
            ) : (
              events.map((ev) => <EventCard key={ev._id} ev={ev} />)
            )}
          </div>
        )}

        {/* Milestones Tab */}
        {activeTab === 'milestones' && (
          <div>
            {milestones.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: 48,
                color: '#999',
                background: '#fff',
                borderRadius: 12,
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                <div>未來 12 個月內尚無記錄的臨床里程碑</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>資料來源：biotech_milestones collection</div>
              </div>
            ) : (
              milestones.map((m) => <MilestoneCard key={m._id} m={m} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
