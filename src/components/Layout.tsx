import { NavLink, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-gray-200">
          <NavLink to="/" className="block">
            <h1 className="text-xl font-semibold text-gray-900">Truv Brain</h1>
            <p className="text-xs text-gray-500 mt-1">Marketing Knowledge Base</p>
          </NavLink>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          {/* Main Section */}
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 px-3">
            Knowledge Base
          </p>
          <ul className="space-y-1 mb-6">
            <li>
              <NavLink
                to="/proof-points"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-lg">📚</span>
                Proof Points
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/products"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-lg">📦</span>
                Products
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/personas"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-lg">👤</span>
                Personas
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/brand"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-lg">🎨</span>
                Brand Guidelines
              </NavLink>
            </li>
          </ul>

          {/* Campaigns Section */}
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 px-3">
            Campaigns
          </p>
          <ul className="space-y-1 mb-6">
            <li>
              <NavLink
                to="/campaigns"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-lg">📧</span>
                Campaign Logic
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/email-builder"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-lg">✉️</span>
                Email Builder
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/list-builder"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-lg">📋</span>
                List Builder
              </NavLink>
            </li>
          </ul>

          {/* Tools Section */}
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 px-3">
            Tools
          </p>
          <ul className="space-y-1">
            <li>
              <NavLink
                to="/roi-generator"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-lg">🧮</span>
                ROI Generator
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/data-enrichment"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-lg">🔍</span>
                Data Enrichment
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/expert-review"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-lg">⭐</span>
                Expert Review
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/url-to-email"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <span className="text-lg">📧</span>
                URL to Email
              </NavLink>
            </li>
            <li>
              <a
                href="https://github.com/cameronwolf-coder/truv-brain"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <span className="text-lg">📁</span>
                GitHub
                <span className="text-xs text-gray-400 ml-auto">↗</span>
              </a>
            </li>
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`
            }
          >
            <span className="text-lg">🏠</span>
            Home
          </NavLink>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
