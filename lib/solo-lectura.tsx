"use client";

import { createContext, useContext } from "react";

/**
 * ¿La pantalla se está renderizando en SOLO LECTURA?
 *
 * Existe por el rol `auditor`, que entra al panel y no escribe en ninguna parte.
 * Se resuelve en el servidor (`requiereStaffOAuditor`, `esAuditor`) y se baja por
 * contexto en vez de por props porque los controles que hay que esconder viven
 * tres o cuatro niveles abajo del componente que conoce el rol, repartidos entre
 * filas, formularios y diálogos; hilarlo a mano obligaría a tocar cada firma
 * intermedia y a acordarse de todas.
 *
 * ESTO NO ES LA SEGURIDAD, y conviene decirlo aquí porque un archivo llamado
 * "solo-lectura" invita a creer lo contrario: esconder un botón no impide un
 * POST. Quien lo impide es la barrera restrictiva de RLS (migración
 * 20260929130000) y, antes, la guarda `puedeEscribirEnPanel` de cada server
 * action. Lo de aquí es para que el panel no ofrezca lo que el servidor va a
 * rechazar.
 *
 * El valor por defecto es `false`: una pantalla que se olvide de envolver su
 * árbol se comporta como siempre. Es lo correcto —lo contrario dejaría paneles
 * mudos por un descuido— y es justo por eso que la garantía vive en la base.
 */
const SoloLecturaContext = createContext(false);

export function SoloLecturaProvider({
  valor,
  children,
}: {
  valor: boolean;
  children: React.ReactNode;
}) {
  return (
    <SoloLecturaContext.Provider value={valor}>{children}</SoloLecturaContext.Provider>
  );
}

export function useSoloLectura(): boolean {
  return useContext(SoloLecturaContext);
}
