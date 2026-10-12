// Renders the tutor's Markdown reply as real headings, lists and tables.
// Install once:  cd frontend && npm i react-markdown remark-gfm
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components = {
  h1: (p) => <h3 className="text-base font-bold text-gray-900 mt-2 mb-2" {...p} />,
  h2: (p) => <h3 className="text-base font-bold text-gray-900 mt-2 mb-2" {...p} />,
  h3: (p) => <h4 className="text-sm font-bold text-gray-900 mt-2 mb-1" {...p} />,
  p: (p) => <p className="text-sm leading-relaxed text-gray-800 my-2" {...p} />,
  strong: (p) => <strong className="font-semibold text-gray-900" {...p} />,
  ul: (p) => <ul className="list-disc pl-5 my-2 space-y-1 text-sm text-gray-800" {...p} />,
  ol: (p) => <ol className="list-decimal pl-5 my-2 space-y-1 text-sm text-gray-800" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  blockquote: (p) => (
    <blockquote className="border-l-4 border-indigo-300 bg-indigo-50 px-3 py-1 my-2 text-sm text-gray-700" {...p} />
  ),
  code: ({ inline, ...p }) =>
    inline ? (
      <code className="bg-gray-100 text-indigo-700 px-1 py-0.5 rounded text-[13px]" {...p} />
    ) : (
      <code className="block bg-gray-900 text-gray-100 p-3 rounded-lg text-[13px] overflow-x-auto my-2" {...p} />
    ),
  table: (p) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm" {...p} />
    </div>
  ),
  thead: (p) => <thead className="bg-indigo-50" {...p} />,
  th: (p) => <th className="px-3 py-2 text-left font-semibold text-indigo-900 border-b border-gray-200" {...p} />,
  td: (p) => <td className="px-3 py-2 align-top text-gray-800 border-b border-gray-100" {...p} />,
};

export default function AiMessage({ text }) {
  return (
    <div className="min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text || ''}
      </ReactMarkdown>
    </div>
  );
}
