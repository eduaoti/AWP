export default function Alert({
  kind = "error",
  children,
}: {
  kind?: "info" | "success" | "error";
  children: any;
}) {
  const color =
    kind === "success"
      ? "bg-green-100 text-green-800 border-green-300"
      : kind === "info"
      ? "bg-blue-100 text-blue-800 border-blue-300"
      : "bg-red-100 text-red-800 border-red-300";

  return (
    <div className={`border ${color} px-3 py-2 rounded-md text-sm`}>
      {children}
    </div>
  );
}
