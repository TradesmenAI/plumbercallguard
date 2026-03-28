'use client'

import { useEffect, useState } from 'react'

/* ── Data ─────────────────────────────────────────────────────── */
const FAQS = [
  { q: 'Does it ever quote prices?', a: 'Never. It only takes the caller\'s name, number, area, and job description. Quoting is always down to you.' },
  { q: 'Do calls still ring my phone first?', a: 'Yes. It only steps in when you miss it — after your normal rings run out.' },
  { q: 'What does it sound like to my customers?', a: 'Professional. It answers as your business, keeps it brief, and leaves them confident someone will call back.' },
  { q: 'Is there a contract?', a: 'No. Cancel any time. Your first 7 days are completely free.' },
  { q: 'How fast do I get notified?', a: 'Within seconds of the call ending — WhatsApp or SMS, your choice.' },
  { q: 'Can I keep my existing number?', a: 'Yes. We forward calls from your existing number. Nothing changes for your customers.' },
]

/* ── Hero Illustration ───────────────────────────────────────── */
function HeroIllustration() {
  return (
    <div style={{ position: 'relative', width: 280, height: 400, margin: '0 auto', flexShrink: 0 }}>

      {/* Pulse rings behind phone */}
      <div className="pulse-ring" style={{
        position: 'absolute', top: -8, left: '50%', marginLeft: -78,
        width: 156, height: 276, borderRadius: 36,
        border: '2px solid rgba(151,201,61,0.35)',
        pointerEvents: 'none',
      }} />

      {/* Phone device */}
      <div className="phone-float" style={{
        position: 'absolute', top: 0, left: '50%', marginLeft: -70,
        width: 140, height: 260,
        background: 'linear-gradient(145deg, #2C2C2C, #1A1A1A)',
        borderRadius: 28, padding: 10,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
        {/* Screen */}
        <div style={{
          background: '#111', borderRadius: 20,
          height: '100%', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 10, padding: 12,
        }}>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>09:41</div>

          {/* Missed call notification */}
          <div style={{
            background: '#fee2e2', borderRadius: 10,
            padding: '9px 12px', width: '100%',
          }}>
            <div style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, letterSpacing: '0.06em' }}>MISSED CALL</div>
            <div style={{ fontSize: 13, color: '#1C1C1C', fontWeight: 700, marginTop: 2 }}>Unknown Number</div>
            <div style={{ fontSize: 9, color: '#9A9590', marginTop: 1 }}>Just now · Tap to call back</div>
          </div>

          {/* Voicemail */}
          <div style={{
            background: '#1a1a1a', border: '1px solid #2a2a2a',
            borderRadius: 8, padding: '7px 10px', width: '100%',
          }}>
            <div style={{ fontSize: 9, color: '#555' }}>Voicemail</div>
            <div style={{ fontSize: 11, color: '#444' }}>No message left</div>
          </div>
        </div>
      </div>

      {/* PCG badge */}
      <div className="pcg-badge" style={{
        position: 'absolute', top: 12, left: 0,
        background: '#97C93D', borderRadius: 10,
        padding: '6px 11px',
        fontSize: 10, fontWeight: 800, color: '#1C1C1C',
        letterSpacing: '0.06em',
        boxShadow: '0 4px 12px rgba(151,201,61,0.35)',
      }}>
        PCG ✓
      </div>

      {/* Connecting arc SVG */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
        viewBox="0 0 280 400"
      >
        <path
          className="arc-path"
          d="M 140 258 C 195 285, 225 320, 196 358"
          stroke="#97C93D"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="6 5"
        />
        <circle
          cx="196" cy="360" r="4" fill="#97C93D"
          style={{ animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) 2.25s both' }}
        />
      </svg>

      {/* Captured card */}
      <div className="capture-card" style={{
        position: 'absolute', bottom: 0, right: 0,
        background: '#fff', borderRadius: 18,
        padding: '13px 15px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        border: '2px solid #97C93D',
        width: 162,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
          <div style={{
            width: 20, height: 20, background: '#97C93D', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#1C1C1C', flexShrink: 0,
          }}>✓</div>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#1C1C1C', letterSpacing: '0.07em' }}>CAPTURED</span>
        </div>
        <div style={{ fontSize: 11, color: '#4A4540', lineHeight: 1.55 }}>
          <strong style={{ color: '#1C1C1C' }}>Dave</strong> — burst pipe, Watford
        </div>
        <div style={{ fontSize: 10, color: '#97C93D', fontWeight: 700, marginTop: 5 }}>
          WhatsApp sent ✓
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [missed, setMissed] = useState(5)
  const [jobVal, setJobVal] = useState(350)
  const [leadPct, setLeadPct] = useState(60)

  const annual = missed * 52 * (leadPct / 100) * jobVal
  const monthly = Math.round(annual / 12)

  /* Scroll reveal */
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          const delay = parseInt(el.dataset.delay || '0', 10)
          setTimeout(() => el.classList.add('revealed'), delay)
          io.unobserve(el)
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const C = {
    cream: '#F5F2ED',
    charcoal: '#1C1C1C',
    green: '#97C93D',
    amber: '#E86B3C',
    lightGrey: '#EAE7E2',
    greyMid: '#9A9590',
    greyText: '#4A4540',
    card: '#fff',
  }

  const display = { fontFamily: 'var(--font-display)' }

  return (
    <>
      {/* ═══ NAV ══════════════════════════════════════════════════ */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(245,242,237,0.94)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid #E0DDD8',
        padding: '0 20px', height: 58,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <a href="/" style={{ ...display, fontSize: 19, fontWeight: 800, color: C.charcoal, textDecoration: 'none' }}>
          Plumber<span style={{ color: C.green }}>CallGuard</span>
        </a>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <a href="#how" className="nav-link" style={{ fontSize: 14, color: C.greyText, fontWeight: 500, padding: '8px 10px', textDecoration: 'none', display: 'none' as const }}>
            How it works
          </a>
          <a href="#pricing" className="nav-link" style={{ fontSize: 14, color: C.greyText, fontWeight: 500, padding: '8px 10px', textDecoration: 'none' }}>
            Pricing
          </a>
          <a href="https://plumbercallguard.co.uk/blog" className="nav-link" style={{ fontSize: 14, color: C.greyText, fontWeight: 500, padding: '8px 10px', textDecoration: 'none' }}>
            Blog
          </a>
          <a href="/signup" className="pcg-btn hide-mobile" style={{
            background: C.green, color: C.charcoal,
            padding: '10px 18px', borderRadius: 10,
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
            display: 'inline-block',
          }}>
            Start free trial
          </a>
        </div>
      </nav>

      {/* ═══ HERO ═════════════════════════════════════════════════ */}
      <section style={{ background: C.cream, padding: '72px 20px 80px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}
          className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">

          {/* Text */}
          <div className="text-center md:text-left">
            <div className="anim-up d1" style={{
              display: 'inline-block',
              background: C.charcoal, color: C.green,
              fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
              padding: '6px 14px', borderRadius: 100, marginBottom: 20,
            }}>
              FOR UK PLUMBERS
            </div>

            <h1 className="anim-up d2" style={{
              ...display,
              fontSize: 'clamp(50px, 9vw, 82px)',
              fontWeight: 900, lineHeight: 1.0,
              color: C.charcoal, marginBottom: 18,
            }}>
              Stop losing jobs<br />to missed calls.
            </h1>

            <p className="anim-up d3" style={{
              fontSize: 17, color: C.greyText, lineHeight: 1.65,
              maxWidth: 480, marginBottom: 32,
            }}
              // mobile: centre subtext; desktop: handled by md:text-left
            >
              When you&rsquo;re on the tools and can&rsquo;t pick up, we answer as your business, take the details, and text you straight away.
            </p>

            <div className="anim-up d4 flex flex-wrap gap-3 justify-center md:justify-start">
              <a href="/signup" className="pcg-btn" style={{
                background: C.green, color: C.charcoal,
                padding: '15px 26px', borderRadius: 12,
                fontSize: 16, fontWeight: 700, textDecoration: 'none',
                display: 'inline-block',
              }}>
                Start 7-day free trial
              </a>
              <a href="#how" className="pcg-btn" style={{
                background: 'transparent', color: C.charcoal,
                border: `2px solid ${C.charcoal}`,
                padding: '13px 24px', borderRadius: 12,
                fontSize: 16, fontWeight: 600, textDecoration: 'none',
                display: 'inline-block',
              }}>
                See how it works
              </a>
            </div>

            <p className="anim-fade d5" style={{ fontSize: 13, color: C.greyMid, marginTop: 14 }}>
              No contract. Cancel any time.
            </p>
          </div>

          {/* Illustration */}
          <div className="anim-fade d3 flex justify-center">
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* ═══ PROBLEM ══════════════════════════════════════════════ */}
      <section style={{ background: C.charcoal, padding: '72px 20px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          <div data-reveal style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 11, color: C.green, fontWeight: 800, letterSpacing: '0.12em', marginBottom: 14 }}>THE PROBLEM</p>
            <h2 style={{ ...display, fontSize: 'clamp(38px, 7vw, 62px)', fontWeight: 900, color: '#F5F2ED', lineHeight: 1.05 }}>
              Every missed call<br />is a lost job.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            {[
              { num: '27%', label: 'of plumbing calls go unanswered', sub: 'That\'s 1 in 4 customers gone.' },
              { num: '£350', label: 'average job value', sub: 'Lost before you knew they called.' },
              { num: '3–5', label: 'jobs lost per week', sub: 'For a typical one-man firm.' },
            ].map((stat, i) => (
              <div key={i} data-reveal data-delay={String(i * 80)} className="pcg-card" style={{
                background: '#252525', borderRadius: 16, padding: '26px 22px',
              }}>
                <div style={{ ...display, fontSize: 52, fontWeight: 900, color: C.green, lineHeight: 1 }}>{stat.num}</div>
                <div style={{ fontSize: 15, color: '#F0EDE8', fontWeight: 600, marginTop: 8, marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 13, color: C.greyMid }}>{stat.sub}</div>
              </div>
            ))}
          </div>

          <div data-reveal style={{
            background: '#252525', borderRadius: 14,
            padding: '20px 24px',
            borderLeft: `4px solid ${C.amber}`,
          }}>
            <p style={{ fontSize: 16, color: '#F0EDE8', lineHeight: 1.65, margin: 0 }}>
              You call back hours later.&nbsp;
              <span style={{ color: C.greyMid }}>They&rsquo;ve already booked someone else. You lost that job before you knew it existed.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═════════════════════════════════════════ */}
      <section style={{ background: C.cream, padding: '80px 20px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          {/* Stats bar */}
          <div data-reveal className="grid grid-cols-3 gap-px" style={{
            background: '#D8D4CF', borderRadius: 16,
            overflow: 'hidden', marginBottom: 52,
          }}>
            {[
              { num: '1,284', label: 'Calls captured' },
              { num: '£48.6k', label: 'Revenue protected' },
              { num: '186 hrs', label: 'Admin saved' },
            ].map((s, i) => (
              <div key={i} style={{ background: C.cream, padding: '24px 16px', textAlign: 'center' }}>
                <div style={{ ...display, fontSize: 38, fontWeight: 900, color: i === 1 ? C.green : C.charcoal, lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontSize: 11, color: C.greyMid, fontWeight: 700, letterSpacing: '0.06em', marginTop: 6, textTransform: 'uppercase' as const }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Quotes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { quote: '"Saves me chasing voicemails, calling people back blind, and the quote side is loads quicker."', name: 'Tom', location: 'Essex', role: 'Solo plumber, 8 years' },
              { quote: '"Picked up a £900 job I would\'ve missed. Paid for itself in the first week."', name: 'Mark', location: 'Birmingham', role: 'Emergency plumber, 12 years' },
            ].map((t, i) => (
              <div key={i} data-reveal data-delay={String(i * 100)} className="pcg-card" style={{
                background: C.card, border: `1px solid #E0DDD8`,
                borderRadius: 20, padding: '26px 22px',
                boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
              }}>
                <div style={{ marginBottom: 14 }}>
                  {'★★★★★'.split('').map((_, j) => (
                    <span key={j} style={{ color: C.green, fontSize: 15 }}>★</span>
                  ))}
                </div>
                <p style={{ fontSize: 15, color: C.greyText, lineHeight: 1.65, fontStyle: 'italic', marginBottom: 20 }}>{t.quote}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, background: C.charcoal, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: C.green, flexShrink: 0,
                  }}>{t.name[0]}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.charcoal }}>{t.name}, {t.location}</div>
                    <div style={{ fontSize: 12, color: C.greyMid }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═════════════════════════════════════════ */}
      <section id="how" style={{ background: C.lightGrey, padding: '80px 20px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          <div data-reveal style={{ textAlign: 'center', marginBottom: 52 }}>
            <p style={{ fontSize: 11, color: C.green, fontWeight: 800, letterSpacing: '0.12em', marginBottom: 14 }}>HOW IT WORKS</p>
            <h2 style={{ ...display, fontSize: 'clamp(36px, 6vw, 56px)', fontWeight: 900, color: C.charcoal, lineHeight: 1.05 }}>
              Simple. Fast. Done.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { num: '01', icon: '📞', title: 'Customer calls', body: 'They ring your number. You\'re on a job. No answer.' },
              { num: '02', icon: '🎙️', title: 'We pick it up', body: 'A professional assistant answers as your business, gets their details.' },
              { num: '03', icon: '📲', title: 'You get the story', body: 'Within seconds — name, number, area, job type. Ready to call back.' },
            ].map((step, i) => (
              <div key={i} data-reveal data-delay={String(i * 100)} className="pcg-card" style={{
                background: C.cream, borderRadius: 20, padding: '30px 26px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <span style={{ fontSize: 30 }}>{step.icon}</span>
                  <span style={{ ...display, fontSize: 52, fontWeight: 900, color: '#D8D4CF', lineHeight: 1 }}>{step.num}</span>
                </div>
                <h3 style={{ ...display, fontSize: 24, fontWeight: 800, color: C.charcoal, marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 15, color: C.greyText, lineHeight: 1.6, margin: 0 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ BEFORE / AFTER ═══════════════════════════════════════ */}
      <section style={{ background: C.cream, padding: '80px 20px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          <div data-reveal style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontSize: 11, color: C.greyMid, fontWeight: 800, letterSpacing: '0.12em', marginBottom: 14 }}>BEFORE VS. AFTER</p>
            <h2 style={{ ...display, fontSize: 'clamp(32px, 6vw, 54px)', fontWeight: 900, color: C.charcoal, lineHeight: 1.05 }}>
              Voicemail chaos vs.<br />a clean summary.
            </h2>
          </div>

          <div data-reveal className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Before */}
            <div style={{ background: C.lightGrey, borderRadius: 20, padding: '26px 22px' }}>
              <div style={{ fontSize: 11, color: C.greyMid, fontWeight: 800, letterSpacing: '0.07em', marginBottom: 20 }}>THE OLD WAY</div>
              {[
                'Missed call, no info',
                'Vague or missing voicemail',
                'Re-listen, guess the address',
                'Call back blind, re-ask everything',
                'Quote from foggy memory at 10pm',
                'Quote disappears — no follow-up',
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 0',
                  borderBottom: i < 5 ? `1px solid #D4D0CB` : 'none',
                }}>
                  <span style={{ color: '#dc2626', fontSize: 13, flexShrink: 0 }}>✕</span>
                  <span style={{ fontSize: 14, color: C.greyText }}>{item}</span>
                </div>
              ))}
            </div>

            {/* After */}
            <div style={{ background: C.charcoal, borderRadius: 20, padding: '26px 22px', border: `2px solid ${C.green}` }}>
              <div style={{ fontSize: 11, color: C.green, fontWeight: 800, letterSpacing: '0.07em', marginBottom: 20 }}>WITH PLUMBERCALLGUARD</div>
              {[
                'Name, number, area, job summary',
                'Urgent jobs stand out',
                'Instant recap — WhatsApp or SMS',
                'Call back with the full story',
                'Quote builder pre-filled from the call',
                'Portal tracks every quote status',
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 0',
                  borderBottom: i < 5 ? `1px solid #2A2A2A` : 'none',
                }}>
                  <span style={{ color: C.green, fontSize: 13, flexShrink: 0 }}>✓</span>
                  <span style={{ fontSize: 14, color: '#F0EDE8' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CALCULATOR ═══════════════════════════════════════════ */}
      <section style={{ background: C.charcoal, padding: '80px 20px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          <div data-reveal style={{ textAlign: 'center', marginBottom: 44 }}>
            <p style={{ fontSize: 11, color: C.green, fontWeight: 800, letterSpacing: '0.12em', marginBottom: 14 }}>THE MATHS MOST PLUMBERS NEVER DO</p>
            <h2 style={{ ...display, fontSize: 'clamp(32px, 6vw, 52px)', fontWeight: 900, color: '#F5F2ED', lineHeight: 1.05 }}>
              {missed} missed calls a week.<br />
              <span style={{ color: C.green }}>£{Math.round(annual).toLocaleString('en-GB')} a year.</span>
            </h2>
            <p style={{ fontSize: 15, color: C.greyMid, marginTop: 14 }}>Adjust the sliders for your own numbers.</p>
          </div>

          <div data-reveal style={{ background: '#252525', borderRadius: 20, padding: '30px 26px' }}>
            {([
              { label: `Missed calls per week: ${missed}`, value: missed, min: 1, max: 20, step: 1, set: setMissed },
              { label: `Average job value: £${jobVal}`, value: jobVal, min: 100, max: 1000, step: 50, set: setJobVal },
              { label: `% that are genuine leads: ${leadPct}%`, value: leadPct, min: 10, max: 100, step: 5, set: setLeadPct },
            ] as { label: string; value: number; min: number; max: number; step: number; set: (v: number) => void }[]).map((s, i) => (
              <div key={i} style={{ marginBottom: i < 2 ? 24 : 0 }}>
                <div style={{ fontSize: 14, color: '#F0EDE8', fontWeight: 500, marginBottom: 10 }}>{s.label}</div>
                <input
                  type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                  onChange={(e) => s.set(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            ))}

            <div style={{
              background: '#1C1C1C', borderRadius: 14,
              padding: '24px 20px', marginTop: 26, textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: C.greyMid, fontWeight: 800, letterSpacing: '0.1em', marginBottom: 8 }}>ESTIMATED MONTHLY REVENUE AT RISK</div>
              <div style={{ ...display, fontSize: 58, fontWeight: 900, color: C.green, lineHeight: 1 }}>
                £{monthly.toLocaleString('en-GB')}
              </div>
              <div style={{ fontSize: 13, color: C.greyMid, marginTop: 8 }}>
                £{Math.round(annual).toLocaleString('en-GB')} a year — and that&rsquo;s conservative
              </div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>
                PlumberCallGuard Standard is £197/mo. One recovered job more than covers it.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PRICING ══════════════════════════════════════════════ */}
      <section id="pricing" style={{ background: C.cream, padding: '80px 20px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          <div data-reveal style={{ textAlign: 'center', marginBottom: 52 }}>
            <p style={{ fontSize: 11, color: C.greyMid, fontWeight: 800, letterSpacing: '0.12em', marginBottom: 14 }}>PRICING</p>
            <h2 style={{ ...display, fontSize: 'clamp(32px, 6vw, 52px)', fontWeight: 900, color: C.charcoal, lineHeight: 1.05 }}>
              Protect every call. Keep the{' '}
              <span style={{ color: C.green }}>founding price</span> for life.
            </h2>
            <p style={{ fontSize: 16, color: C.greyMid, marginTop: 14 }}>Two plans. No lock-in. 7 days free.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Standard */}
            <div data-reveal className="pcg-card" style={{
              background: C.card, border: `2px solid #E0DDD8`,
              borderRadius: 24, padding: '34px 26px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                fontSize: 11, background: C.lightGrey, color: C.greyText,
                fontWeight: 800, letterSpacing: '0.09em',
                padding: '5px 12px', borderRadius: 100,
                display: 'inline-block', marginBottom: 18,
              }}>STANDARD</div>
              <h3 style={{ ...display, fontSize: 22, fontWeight: 800, color: C.charcoal, marginBottom: 4 }}>For the solo operator</h3>
              <p style={{ fontSize: 13, color: C.greyMid, marginBottom: 18 }}>30–75 calls/month, one marketing channel</p>
              <div style={{ marginBottom: 6 }}>
                <span style={{ ...display, fontSize: 54, fontWeight: 900, color: C.charcoal, lineHeight: 1 }}>£197</span>
                <span style={{ fontSize: 16, color: C.greyMid }}>/mo</span>
              </div>
              <p style={{ fontSize: 13, color: C.greyMid, marginBottom: 22 }}>
                <s>Was £247/mo</s> — founding rate, locked for life
              </p>
              <div style={{ borderTop: `1px solid ${C.lightGrey}`, paddingTop: 18, marginBottom: 26 }}>
                {['24/7 call capture', 'Instant recap — SMS or WhatsApp', 'Quote builder (CallStack™)', 'Call recordings + transcripts', 'Portal with quote tracking', '5-minute onboarding'].map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', fontSize: 14, color: C.greyText }}>
                    <span style={{ color: C.green, fontWeight: 700, flexShrink: 0 }}>✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <a href="/signup" className="pcg-btn" style={{
                display: 'block', textAlign: 'center',
                background: C.charcoal, color: C.cream,
                padding: '14px', borderRadius: 12,
                fontSize: 15, fontWeight: 700, textDecoration: 'none',
              }}>
                Start 7-Day Free Trial
              </a>
            </div>

            {/* Pro */}
            <div data-reveal data-delay="100" className="pcg-card" style={{
              background: C.charcoal, borderRadius: 24,
              padding: '34px 26px', border: `2px solid ${C.green}`,
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: -1, left: 22,
                background: C.green, color: C.charcoal,
                fontSize: 10, fontWeight: 800, padding: '4px 12px',
                borderRadius: '0 0 8px 8px', letterSpacing: '0.09em',
              }}>MOST COMPLETE</div>

              <div style={{ marginTop: 18, marginBottom: 18 }}>
                <div style={{
                  fontSize: 11, background: '#2A2A2A', color: C.greyMid,
                  fontWeight: 800, letterSpacing: '0.09em',
                  padding: '5px 12px', borderRadius: 100,
                  display: 'inline-block',
                }}>PRO</div>
              </div>
              <h3 style={{ ...display, fontSize: 22, fontWeight: 800, color: '#F0EDE8', marginBottom: 4 }}>For the growing firm</h3>
              <p style={{ fontSize: 13, color: C.greyMid, marginBottom: 18 }}>75+ calls/month, running Google Ads + website</p>
              <div style={{ marginBottom: 6 }}>
                <span style={{ ...display, fontSize: 54, fontWeight: 900, color: C.green, lineHeight: 1 }}>£347</span>
                <span style={{ fontSize: 16, color: C.greyMid }}>/mo</span>
              </div>
              <p style={{ fontSize: 13, color: C.greyMid, marginBottom: 22 }}>
                <s>Was £397/mo</s> — founding rate, locked for life
              </p>
              <div style={{ borderTop: '1px solid #2A2A2A', paddingTop: 18, marginBottom: 26 }}>
                {['Everything in Standard', 'Unlimited review requests (StarStack™)', 'Unlimited QuickQuoter sessions', 'Quote follow-up sequences', 'Monthly strategy calls', 'Which channel delivers your best leads'].map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', fontSize: 14, color: '#F0EDE8' }}>
                    <span style={{ color: C.green, fontWeight: 700, flexShrink: 0 }}>✓</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <a href="/signup" className="pcg-btn" style={{
                display: 'block', textAlign: 'center',
                background: C.green, color: C.charcoal,
                padding: '14px', borderRadius: 12,
                fontSize: 15, fontWeight: 700, textDecoration: 'none',
              }}>
                Start 7-Day Free Trial
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ══════════════════════════════════════════════════ */}
      <section style={{ background: C.lightGrey, padding: '80px 20px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          <div data-reveal style={{ textAlign: 'center', marginBottom: 44 }}>
            <p style={{ fontSize: 11, color: C.greyMid, fontWeight: 800, letterSpacing: '0.12em', marginBottom: 14 }}>QUESTIONS</p>
            <h2 style={{ ...display, fontSize: 'clamp(32px, 6vw, 48px)', fontWeight: 900, color: C.charcoal, lineHeight: 1.05 }}>
              Clear answers before you commit.
            </h2>
          </div>

          <div data-reveal>
            {FAQS.map((faq, i) => (
              <div key={i} style={{
                background: openFaq === i ? C.card : C.cream,
                borderRadius: 14, marginBottom: 8,
                overflow: 'hidden',
                border: openFaq === i ? `1px solid #D8D4CF` : '1px solid transparent',
                transition: 'background 200ms',
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="pcg-btn"
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '18px 20px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.charcoal, paddingRight: 12 }}>{faq.q}</span>
                  <span className={`faq-icon${openFaq === i ? ' open' : ''}`} style={{
                    fontSize: 22, color: C.green, flexShrink: 0, lineHeight: 1,
                  }}>+</span>
                </button>
                <div className={`faq-answer${openFaq === i ? ' open' : ''}`}>
                  <p style={{ padding: '0 20px 18px', fontSize: 15, color: C.greyText, lineHeight: 1.65, margin: 0 }}>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ════════════════════════════════════════════ */}
      <section style={{ background: C.charcoal, padding: '96px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: 580, margin: '0 auto' }}>
          <div data-reveal>
            <p style={{ fontSize: 11, color: C.green, fontWeight: 800, letterSpacing: '0.12em', marginBottom: 20 }}>NO RISK. 7 DAYS FREE.</p>
            <h2 style={{ ...display, fontSize: 'clamp(42px, 8vw, 70px)', fontWeight: 900, color: '#F5F2ED', lineHeight: 1.0, marginBottom: 22 }}>
              Don&rsquo;t lose<br />another job.
            </h2>
            <p style={{ fontSize: 17, color: C.greyMid, marginBottom: 36, lineHeight: 1.6 }}>
              5 minutes to set up. Live within the hour.
            </p>
            <a href="/signup" className="pcg-btn" style={{
              display: 'inline-block',
              background: C.green, color: C.charcoal,
              padding: '20px 36px', borderRadius: 14,
              fontSize: 18, fontWeight: 800, textDecoration: 'none',
              letterSpacing: '0.01em',
            }}>
              Start Your Free Trial →
            </a>
            <p style={{ fontSize: 13, color: '#4A4540', marginTop: 16 }}>No card required. Cancel any time.</p>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════ */}
      <footer style={{ background: '#141414', padding: '30px 20px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}
          className="flex flex-wrap justify-between items-center gap-4">
          <div style={{ ...display, fontSize: 17, fontWeight: 800, color: '#444' }}>
            Plumber<span style={{ color: C.green }}>CallGuard</span>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' as const }}>
            {['Privacy', 'Terms', 'Support', 'Portal'].map((link) => (
              <a key={link} href={`/${link.toLowerCase()}`} style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}
                className="nav-link">
                {link}
              </a>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#3A3A3A' }}>© 2025 PlumberCallGuard Ltd.</div>
        </div>
      </footer>
    </>
  )
}
