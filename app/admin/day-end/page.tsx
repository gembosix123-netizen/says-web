import DayEndClosing from '@/components/features/admin/DayEndClosing';

export default function DayEndPage() {
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Day End Closing</h1>
          <p className="text-slate-400 mt-2">Review daily sales, reconcile cash, and generate closing reports</p>
        </div>
        
        <DayEndClosing />
      </div>
    </div>
  );
}
