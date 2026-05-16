
import React from 'react';

const LinearDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-canvas text-ink pb-20">
      {/* Top Navigation */}
      <nav className="nav-top">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 font-display font-semibold text-xl tracking-tight text-ink">
            <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full"></div>
            </div>
            Linear
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-ink-subtle text-sm hover:text-ink transition-colors">Log in</button>
          <button className="btn-primary">Sign up</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-1 border border-hairline rounded-full text-xs text-ink-muted mb-8 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
          Linear for Teams
        </div>
        <h1 className="text-5xl md:text-7xl font-display font-semibold text-ink leading-[1.1] tracking-tighter mb-8 animate-slide-up">
          Linear is a better way <br /> to build products.
        </h1>
        <p className="text-xl text-ink-muted max-w-2xl mx-auto mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          Meet the new standard for modern software development. Streamline issues, projects, and product roadmaps.
        </p>
        <div className="flex items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <button className="btn-primary px-8 py-3">Get started</button>
          <button className="btn-secondary px-8 py-3">Read the method</button>
        </div>

        {/* Hero Product Screenshot */}
        <div className="mt-20 p-6 bg-surface-1 border border-hairline rounded-xl mx-auto max-w-4xl shadow-2xl animate-scale-in" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-6 border-b border-hairline pb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-hairline"></div>
              <div className="w-3 h-3 rounded-full bg-hairline"></div>
              <div className="w-3 h-3 rounded-full bg-hairline"></div>
            </div>
            <div className="text-xs text-ink-tertiary font-mono">issue-tracker / inbox</div>
            <div className="w-12"></div>
          </div>
          <div className="space-y-4 text-left">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-canvas/50 border border-hairline rounded-lg hover:border-hairline-strong transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 rounded-sm border border-hairline"></div>
                  <div className="font-mono text-ink-subtle text-xs">LIN-{100 + i}</div>
                  <div className="text-sm font-medium text-ink">Update the design system tokens to reflect Linear alpha</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="px-2 py-0.5 bg-surface-2 border border-hairline rounded-full text-[10px] text-ink-muted">In Progress</div>
                  <div className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center text-[10px] text-ink-tertiary">JD</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: "Built for speed", desc: "Synchronize issues in real-time. Linear is built for speed and efficiency." },
            { title: "Enterprise-grade", desc: "Your data is encrypted at rest and in transit. SOC2 Type II compliant." },
            { title: "Keyboard first", desc: "Everything is accessible via the command menu and keyboard shortcuts." }
          ].map((f, i) => (
            <div key={i} className="card-linear hover:bg-surface-2 hover:border-hairline-strong cursor-default transition-colors">
              <h3 className="text-lg font-semibold text-ink mb-2">{f.title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 border-y border-hairline">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-display font-semibold mb-4">Simple, transparent pricing.</h2>
            <p className="text-ink-muted">Choose the plan that fits your team.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card-linear bg-canvas/30">
              <h4 className="text-xl font-semibold mb-1">Free</h4>
              <p className="text-sm text-ink-subtle mb-6">$0/mo</p>
              <ul className="space-y-3 mb-8">
                {['Unlimited issues', 'Up to 10 users', 'Standard support'].map(f => (
                  <li key={f} className="text-xs text-ink-muted flex items-center gap-2">
                    <div className="w-1 h-1 bg-success rounded-full"></div> {f}
                  </li>
                ))}
              </ul>
              <button className="btn-secondary w-full">Sign up</button>
            </div>
            <div className="card-linear border-primary/40 ring-1 ring-primary/20 bg-surface-1">
              <h4 className="text-xl font-semibold mb-1">Standard</h4>
              <p className="text-sm text-ink-subtle mb-6">$8/mo</p>
              <ul className="space-y-3 mb-8">
                {['Unlimited users', 'Priority support', 'Google SSO'].map(f => (
                  <li key={f} className="text-xs text-ink-muted flex items-center gap-2">
                    <div className="w-1 h-1 bg-success rounded-full"></div> {f}
                  </li>
                ))}
              </ul>
              <button className="btn-primary w-full">Try for free</button>
            </div>
            <div className="card-linear bg-canvas/30">
              <h4 className="text-xl font-semibold mb-1">Plus</h4>
              <p className="text-sm text-ink-subtle mb-6">$14/mo</p>
              <ul className="space-y-3 mb-8">
                {['SAML SSO', 'Priority roadmap', 'Data residency'].map(f => (
                  <li key={f} className="text-xs text-ink-muted flex items-center gap-2">
                    <div className="w-1 h-1 bg-success rounded-full"></div> {f}
                  </li>
                ))}
              </ul>
              <button className="btn-secondary w-full">Contact sales</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LinearDemo;
