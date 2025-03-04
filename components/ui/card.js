export function Card({ children, className }) {
  return (
    <div className={`bg-white shadow-lg rounded-lg p-6 transition transform hover:-translate-y-1 hover:shadow-xl ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ children, className }) {
  return <div className={`text-gray-800 ${className}`}>{children}</div>;
}
