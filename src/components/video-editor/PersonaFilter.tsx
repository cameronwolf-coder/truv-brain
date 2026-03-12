import { useVideoEditor } from '../../hooks/useVideoEditor';
import { PERSONAS, PERSONA_KEYS } from '../../utils/personaDefinitions';
import type { PersonaKey } from '../../types/videoEditor';

const PERSONA_COLORS: Record<PersonaKey, string> = {
  payroll: 'bg-purple-100 text-purple-700 border-purple-300',
  lending: 'bg-green-100 text-green-700 border-green-300',
  background: 'bg-amber-100 text-amber-700 border-amber-300',
  fintech: 'bg-blue-100 text-blue-700 border-blue-300',
};

const PERSONA_ACTIVE_COLORS: Record<PersonaKey, string> = {
  payroll: 'bg-purple-600 text-white border-purple-600',
  lending: 'bg-green-600 text-white border-green-600',
  background: 'bg-amber-600 text-white border-amber-600',
  fintech: 'bg-blue-600 text-white border-blue-600',
};

export { PERSONA_COLORS };

export function PersonaFilter() {
  const { activePersonas, togglePersona } = useVideoEditor();

  return (
    <div className="flex flex-wrap gap-2">
      {PERSONA_KEYS.map((key) => {
        const isActive = activePersonas.includes(key);
        return (
          <button
            key={key}
            onClick={() => togglePersona(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              isActive ? PERSONA_ACTIVE_COLORS[key] : PERSONA_COLORS[key]
            }`}
          >
            {PERSONAS[key].title}
          </button>
        );
      })}
      {activePersonas.length > 0 && (
        <button
          onClick={() => activePersonas.forEach((p) => togglePersona(p))}
          className="px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
