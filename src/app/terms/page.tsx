import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent2 transition-colors mb-8">
          <ChevronLeft className="h-4 w-4" />Back to home
        </Link>
        <h1 className="text-3xl font-black text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: July 1, 2026</p>
        <div className="space-y-6 text-sm text-gray-800 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900">1. Service</h2>
            <p>RYXSOR AI provides store management software for gas stations and convenience stores. By using RYXSOR AI you agree to these terms.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-gray-900">2. Subscription</h2>
            <p>Paid plans are billed monthly. You can cancel at any time. No refunds for partial months. Prices may change with 30 days notice.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-gray-900">3. Your Data</h2>
            <p>You own your data. We provide tools to access and export it. We do not claim ownership of any business data you enter.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-gray-900">4. AI Accuracy</h2>
            <p>AI-generated reports and suggestions are for informational purposes. Always verify critical financial figures against your official POS reports. RYXSOR AI is not liable for financial decisions made based on AI output.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-gray-900">5. Acceptable Use</h2>
            <p>You agree not to use RYXSOR AI for any illegal purpose, attempt to reverse engineer the software, or share your account credentials.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-gray-900">6. Contact</h2>
            <p>RYXSOR AI · bikalkarna@gmail.com · Tyler, Texas</p>
          </section>
        </div>
      </div>
    </div>
  );
}
