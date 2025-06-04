'use client'; // Questo è un Client Component

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button'; // Assicurati che il percorso del tuo componente Button sia corretto

/**
 * Componente per il bottone di Logout.
 * Rimuove il JWT dal localStorage e reindirizza alla pagina di login.
 */
export function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    // 1. Rimuove il JSON Web Token dal localStorage
    localStorage.removeItem('jwt');

    // 2. Potenziale pulizia dei cookie (se in futuro gestirai il JWT anche nei cookie httpOnly)
    //    Per ora, con localStorage, questa riga è opzionale ma utile per la compatibilità futura.
    //    Se il JWT fosse in un cookie httpOnly, avresti bisogno di una API Route Next.js
    //    per eliminare quel cookie in modo sicuro dal server.
    // document.cookie = 'jwt=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'; 

    // 3. Reindirizza l'utente alla pagina di login
    router.push('/login');
  };

  return (
    <Button onClick={handleLogout} variant="destructive" size="lg" className='px-2'>
      Logout
    </Button>
  );
}