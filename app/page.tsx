import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to tiling session monitor as the default view
  redirect('/monitoring/sessions');
}
