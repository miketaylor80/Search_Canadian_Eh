export function Input({ type, placeholder, value, onChange, className }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`p-3 border-2 border-gray-300 rounded-lg w-full shadow-sm focus:ring focus:ring-red-300 ${className}`}
    />
  );
}