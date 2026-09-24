import {Html,Head,Main,NextScript} from 'next/document';
export default function Document(){
  return <Html lang="pt-BR">
    <Head>
      <meta name="theme-color" content="#14532d"/>
      <link rel="icon" href="/icones/alvor-192.png"/>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&display=swap" rel="stylesheet"/>
      <link rel="manifest" href="/api/manifest"/>
      <link rel="apple-touch-icon" href="/icones/alvor-192.png"/>
      <meta name="description" content="Leia a Bíblia em vários idiomas (domínio público), com meta diária, ofensiva e XP opcional. Lê offline, instala na tela do celular."/>
    </Head>
    <body><Main/><NextScript/></body>
  </Html>;
}
