import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent2 transition-colors mb-8">
          <ChevronLeft className="h-4 w-4" />Back to home
        </Link>
        <h1 className="text-3xl font-black text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: July 1, 2026</p>
        <div className="space-y-6 text-sm text-gray-800 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-gray-900">What We Collect</h2>
            <p>RYXSOR AI collects store data you upload — daily sales reports, inventory, employee records, and invoices. We also collect your email address for account creation and your device information for push notifications.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-gray-900">How We Use Your Data</h2>
            <p>Your data is used exclusively to provide the RYXSOR AI service — displaying reports, calculating short/over, managing inventory, and generating AI insights. We never sell your data to third parties.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-gray-900">Data Storage</h2>
            <p>All data is stored securely on Supabase servers with encryption at rest and in transit. Report images are processed by AI and not permanently stored.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-gray-900">Push Notifications</h2>
            <p>With your permission, we send daily summary notifications about your store performance. You can opt out at any time in Settings.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-gray-900">Your Rights</h2>
            <p>You can export or delete your data at any time. Contact us at bikalkarna@gmail.com for any privacy requests.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-gray-900">Contact</h2>
            <p>RYXSOR AI · bikalkarna@gmail.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}
