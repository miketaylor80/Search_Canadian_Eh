export function Button({ onClick, children, className }) {
  return (
    <button
      onClick={onClick}
      className={`bg-red-600 text-white px-5 py-3 text-lg rounded-lg transition hover:bg-red-700 focus:ring-2 focus:ring-red-500 ${className}`}
    >
      {children}
    </button>
  );
}
