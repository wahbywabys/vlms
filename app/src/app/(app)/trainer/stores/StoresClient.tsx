'use client';
import { useRouter } from 'next/navigation';
import { useL } from '@/components/LangProvider';
import { StoresBoard, type StockRow } from '@/components/modules/WorkshopBoards';
import { apiFetch } from '@/lib/browserApi';

export function StoresClient({ items }: { items: StockRow[] }) {
  const { L, lang } = useL();
  const router = useRouter();
  return <StoresBoard ui={{ L, lang }} items={items} onReceive={async (id, qty) => {
    await apiFetch(`/workshop/consumables/${id}/movements`, { body: { clientMutationId: crypto.randomUUID(), delta: qty, reason: 'receipt' } });
    router.refresh();
  }} />;
}
