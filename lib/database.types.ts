export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      areas_tenant: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          orden: number
          tenant_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          tenant_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_tenant_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auditor_actividad: {
        Row: {
          archivo: string | null
          auditor_id: string
          created_at: string
          id: string
          ip: unknown
          navegador: string | null
          objeto_id: string | null
          objeto_tipo: string | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["tipo_actividad_auditor"]
        }
        Insert: {
          archivo?: string | null
          auditor_id: string
          created_at?: string
          id?: string
          ip?: unknown
          navegador?: string | null
          objeto_id?: string | null
          objeto_tipo?: string | null
          tenant_id: string
          tipo: Database["public"]["Enums"]["tipo_actividad_auditor"]
        }
        Update: {
          archivo?: string | null
          auditor_id?: string
          created_at?: string
          id?: string
          ip?: unknown
          navegador?: string | null
          objeto_id?: string | null
          objeto_tipo?: string | null
          tenant_id?: string
          tipo?: Database["public"]["Enums"]["tipo_actividad_auditor"]
        }
        Relationships: [
          {
            foreignKeyName: "auditor_actividad_auditor_id_fkey"
            columns: ["auditor_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auditor_actividad_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bitacora: {
        Row: {
          accion: string
          created_at: string
          detalle: Json
          entidad: string
          entidad_id: string | null
          id: string
          tenant_id: string | null
          usuario_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          detalle?: Json
          entidad: string
          entidad_id?: string | null
          id?: string
          tenant_id?: string | null
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          detalle?: Json
          entidad?: string
          entidad_id?: string | null
          id?: string
          tenant_id?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bitacora_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bitacora_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      capturas_valor: {
        Row: {
          capturado_por: string
          confirmado: boolean
          created_at: string
          evidencia_id: string
          id: string
          justificacion: string | null
          origen: string
          periodo: string | null
          solicitud_id: string
          sugerencia_id: string | null
          unidad: string
          valor: number
        }
        Insert: {
          capturado_por: string
          confirmado?: boolean
          created_at?: string
          evidencia_id: string
          id?: string
          justificacion?: string | null
          origen?: string
          periodo?: string | null
          solicitud_id: string
          sugerencia_id?: string | null
          unidad: string
          valor: number
        }
        Update: {
          capturado_por?: string
          confirmado?: boolean
          created_at?: string
          evidencia_id?: string
          id?: string
          justificacion?: string | null
          origen?: string
          periodo?: string | null
          solicitud_id?: string
          sugerencia_id?: string | null
          unidad?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "capturas_valor_capturado_por_fkey"
            columns: ["capturado_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capturas_valor_evidencia_id_fkey"
            columns: ["evidencia_id"]
            isOneToOne: false
            referencedRelation: "evidencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capturas_valor_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capturas_valor_sugerencia_id_fkey"
            columns: ["sugerencia_id"]
            isOneToOne: false
            referencedRelation: "sugerencias_captura"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios: {
        Row: {
          autor_id: string
          contenido: string
          created_at: string
          es_observacion: boolean
          id: string
          solicitud_id: string
        }
        Insert: {
          autor_id: string
          contenido: string
          created_at?: string
          es_observacion?: boolean
          id?: string
          solicitud_id: string
        }
        Update: {
          autor_id?: string
          contenido?: string
          created_at?: string
          es_observacion?: boolean
          id?: string
          solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios_auditor: {
        Row: {
          autor_id: string
          created_at: string
          id: string
          objeto_id: string
          objeto_tipo: Database["public"]["Enums"]["objeto_comentario_auditor"]
          respondido_en: string | null
          respondido_por: string | null
          respuesta: string | null
          tenant_id: string
          texto: string
        }
        Insert: {
          autor_id: string
          created_at?: string
          id?: string
          objeto_id: string
          objeto_tipo: Database["public"]["Enums"]["objeto_comentario_auditor"]
          respondido_en?: string | null
          respondido_por?: string | null
          respuesta?: string | null
          tenant_id: string
          texto: string
        }
        Update: {
          autor_id?: string
          created_at?: string
          id?: string
          objeto_id?: string
          objeto_tipo?: Database["public"]["Enums"]["objeto_comentario_auditor"]
          respondido_en?: string | null
          respondido_por?: string | null
          respuesta?: string | null
          tenant_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_auditor_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_auditor_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_auditor_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      correos_retenidos: {
        Row: {
          accion: string
          agrupado_en: string | null
          asunto: string
          created_at: string
          destinatario_id: string
          evento: Json
          extracto: string | null
          id: string
          ruta: string | null
          tenant_id: string
        }
        Insert: {
          accion: string
          agrupado_en?: string | null
          asunto: string
          created_at?: string
          destinatario_id: string
          evento: Json
          extracto?: string | null
          id?: string
          ruta?: string | null
          tenant_id: string
        }
        Update: {
          accion?: string
          agrupado_en?: string | null
          asunto?: string
          created_at?: string
          destinatario_id?: string
          evento?: Json
          extracto?: string | null
          id?: string
          ruta?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "correos_retenidos_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correos_retenidos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cuestionarios_respuestas: {
        Row: {
          created_at: string
          hoja: string
          id: string
          notas: string | null
          pregunta_orden: number
          reporte_id: string
          respuesta: string | null
          tipo_dato: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hoja: string
          id?: string
          notas?: string | null
          pregunta_orden: number
          reporte_id: string
          respuesta?: string | null
          tipo_dato?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hoja?: string
          id?: string
          notas?: string | null
          pregunta_orden?: number
          reporte_id?: string
          respuesta?: string | null
          tipo_dato?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuestionarios_respuestas_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
        ]
      }
      datapoints_taxonomia: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          descripcion: string
          id: string
          marco: string
          norma: Database["public"]["Enums"]["norma_niif"]
          ods: string | null
          pilar: Database["public"]["Enums"]["pilar_niif"]
          seccion_indice: string | null
          version_taxonomia: string
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          descripcion: string
          id?: string
          marco?: string
          norma: Database["public"]["Enums"]["norma_niif"]
          ods?: string | null
          pilar: Database["public"]["Enums"]["pilar_niif"]
          seccion_indice?: string | null
          version_taxonomia?: string
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          descripcion?: string
          id?: string
          marco?: string
          norma?: Database["public"]["Enums"]["norma_niif"]
          ods?: string | null
          pilar?: Database["public"]["Enums"]["pilar_niif"]
          seccion_indice?: string | null
          version_taxonomia?: string
        }
        Relationships: []
      }
      documentos_bloques: {
        Row: {
          clave: string
          costo_usd: number
          created_at: string
          documento_id: string
          duracion_ms: number | null
          editado_en: string | null
          editado_por: string | null
          estado: string
          fuentes: Json
          generado_en: string
          id: string
          idioma: string
          intentos: number
          modelo: string | null
          numero: number
          origen_texto: string | null
          pendientes: Json
          prompt_version: string | null
          reclamado_en: string | null
          restaurada_de: string | null
          seccion: string | null
          texto: string | null
          texto_del_emisor: boolean
          titulo: string
          tokens_entrada: number
          tokens_entrada_cache_escritura: number
          tokens_entrada_cache_lectura: number
          tokens_salida: number
          updated_at: string
        }
        Insert: {
          clave: string
          costo_usd?: number
          created_at?: string
          documento_id: string
          duracion_ms?: number | null
          editado_en?: string | null
          editado_por?: string | null
          estado?: string
          fuentes?: Json
          generado_en?: string
          id?: string
          idioma?: string
          intentos?: number
          modelo?: string | null
          numero: number
          origen_texto?: string | null
          pendientes?: Json
          prompt_version?: string | null
          reclamado_en?: string | null
          restaurada_de?: string | null
          seccion?: string | null
          texto?: string | null
          texto_del_emisor?: boolean
          titulo: string
          tokens_entrada?: number
          tokens_entrada_cache_escritura?: number
          tokens_entrada_cache_lectura?: number
          tokens_salida?: number
          updated_at?: string
        }
        Update: {
          clave?: string
          costo_usd?: number
          created_at?: string
          documento_id?: string
          duracion_ms?: number | null
          editado_en?: string | null
          editado_por?: string | null
          estado?: string
          fuentes?: Json
          generado_en?: string
          id?: string
          idioma?: string
          intentos?: number
          modelo?: string | null
          numero?: number
          origen_texto?: string | null
          pendientes?: Json
          prompt_version?: string | null
          reclamado_en?: string | null
          restaurada_de?: string | null
          seccion?: string | null
          texto?: string | null
          texto_del_emisor?: boolean
          titulo?: string
          tokens_entrada?: number
          tokens_entrada_cache_escritura?: number
          tokens_entrada_cache_lectura?: number
          tokens_salida?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_bloques_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_generados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_bloques_editado_por_fkey"
            columns: ["editado_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_bloques_versiones: {
        Row: {
          autor_id: string | null
          costo_usd: number
          created_at: string
          documento_id: string
          editado_en: string | null
          editado_por: string | null
          fuentes: Json
          id: string
          modelo: string | null
          numero: number
          origen: string
          pendientes: Json
          prompt_version: string | null
          restaurada_de: string | null
          tenant_id: string
          texto: string
          texto_del_emisor: boolean
          version: number
        }
        Insert: {
          autor_id?: string | null
          costo_usd?: number
          created_at?: string
          documento_id: string
          editado_en?: string | null
          editado_por?: string | null
          fuentes?: Json
          id?: string
          modelo?: string | null
          numero: number
          origen: string
          pendientes?: Json
          prompt_version?: string | null
          restaurada_de?: string | null
          tenant_id: string
          texto: string
          texto_del_emisor?: boolean
          version: number
        }
        Update: {
          autor_id?: string | null
          costo_usd?: number
          created_at?: string
          documento_id?: string
          editado_en?: string | null
          editado_por?: string | null
          fuentes?: Json
          id?: string
          modelo?: string | null
          numero?: number
          origen?: string
          pendientes?: Json
          prompt_version?: string | null
          restaurada_de?: string | null
          tenant_id?: string
          texto?: string
          texto_del_emisor?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documentos_bloques_versiones_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_bloques_versiones_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_generados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_bloques_versiones_editado_por_fkey"
            columns: ["editado_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_bloques_versiones_restaurada_de_fkey"
            columns: ["restaurada_de"]
            isOneToOne: false
            referencedRelation: "documentos_bloques_versiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_bloques_versiones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_generados: {
        Row: {
          alivios: Json
          aprobado_en: string | null
          aprobado_por: string | null
          archivo_path: string | null
          costo_usd: number
          created_at: string
          editoriales_incluidos: string[] | null
          estado: string
          generado_por: string | null
          id: string
          idioma: string
          regimen: string | null
          reporte_id: string
          tenant_id: string
          textos_literales: Json | null
          tipo: string
          tokens_entrada: number
          tokens_salida: number
          updated_at: string
          version: number
          versiones_aprobadas: Json | null
        }
        Insert: {
          alivios?: Json
          aprobado_en?: string | null
          aprobado_por?: string | null
          archivo_path?: string | null
          costo_usd?: number
          created_at?: string
          editoriales_incluidos?: string[] | null
          estado?: string
          generado_por?: string | null
          id?: string
          idioma?: string
          regimen?: string | null
          reporte_id: string
          tenant_id: string
          textos_literales?: Json | null
          tipo?: string
          tokens_entrada?: number
          tokens_salida?: number
          updated_at?: string
          version?: number
          versiones_aprobadas?: Json | null
        }
        Update: {
          alivios?: Json
          aprobado_en?: string | null
          aprobado_por?: string | null
          archivo_path?: string | null
          costo_usd?: number
          created_at?: string
          editoriales_incluidos?: string[] | null
          estado?: string
          generado_por?: string | null
          id?: string
          idioma?: string
          regimen?: string | null
          reporte_id?: string
          tenant_id?: string
          textos_literales?: Json | null
          tipo?: string
          tokens_entrada?: number
          tokens_salida?: number
          updated_at?: string
          version?: number
          versiones_aprobadas?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_generados_aprobado_por_fkey"
            columns: ["aprobado_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_generados_generado_por_fkey"
            columns: ["generado_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_generados_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_generados_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      evidencias: {
        Row: {
          archivo_path: string
          area_origen: string | null
          cargado_por_staff: boolean
          created_at: string
          id: string
          justificacion: string | null
          nombre_original: string
          notas: string | null
          periodo_cubierto: string | null
          solicitud_id: string
          subido_por: string
          version: number
        }
        Insert: {
          archivo_path: string
          area_origen?: string | null
          cargado_por_staff?: boolean
          created_at?: string
          id?: string
          justificacion?: string | null
          nombre_original: string
          notas?: string | null
          periodo_cubierto?: string | null
          solicitud_id: string
          subido_por: string
          version: number
        }
        Update: {
          archivo_path?: string
          area_origen?: string | null
          cargado_por_staff?: boolean
          created_at?: string
          id?: string
          justificacion?: string | null
          nombre_original?: string
          notas?: string | null
          periodo_cubierto?: string | null
          solicitud_id?: string
          subido_por?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "evidencias_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidencias_subido_por_fkey"
            columns: ["subido_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      evidencias_contenido: {
        Row: {
          archivo_path: string
          bytes: number | null
          contenido: Json | null
          costo_usd: number
          created_at: string
          error: string | null
          estado: Database["public"]["Enums"]["estado_lectura"]
          evidencia_id: string
          hojas: number | null
          id: string
          intentos: number
          mensaje: string | null
          modelo: string | null
          nombre_original: string
          paginas: number | null
          procesado_en: string | null
          solicitud_id: string
          tenant_id: string
          tipo: string | null
          tokens_entrada: number
          tokens_salida: number
          truncado: boolean
          version: number
        }
        Insert: {
          archivo_path: string
          bytes?: number | null
          contenido?: Json | null
          costo_usd?: number
          created_at?: string
          error?: string | null
          estado?: Database["public"]["Enums"]["estado_lectura"]
          evidencia_id: string
          hojas?: number | null
          id?: string
          intentos?: number
          mensaje?: string | null
          modelo?: string | null
          nombre_original: string
          paginas?: number | null
          procesado_en?: string | null
          solicitud_id: string
          tenant_id: string
          tipo?: string | null
          tokens_entrada?: number
          tokens_salida?: number
          truncado?: boolean
          version: number
        }
        Update: {
          archivo_path?: string
          bytes?: number | null
          contenido?: Json | null
          costo_usd?: number
          created_at?: string
          error?: string | null
          estado?: Database["public"]["Enums"]["estado_lectura"]
          evidencia_id?: string
          hojas?: number | null
          id?: string
          intentos?: number
          mensaje?: string | null
          modelo?: string | null
          nombre_original?: string
          paginas?: number | null
          procesado_en?: string | null
          solicitud_id?: string
          tenant_id?: string
          tipo?: string | null
          tokens_entrada?: number
          tokens_salida?: number
          truncado?: boolean
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "evidencias_contenido_evidencia_id_fkey"
            columns: ["evidencia_id"]
            isOneToOne: true
            referencedRelation: "evidencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidencias_contenido_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidencias_contenido_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hechos: {
        Row: {
          bloque_dueno: number | null
          bloques_referencia: number[]
          clave: string
          conflicto: string | null
          created_at: string
          enunciado: string
          estado: string
          extracto: string
          fuente_detalle: string
          fuente_id: string
          fuente_tipo: string
          grupo_conflicto: string | null
          id: string
          libro_id: string
          periodo: string | null
          rango_fuente: string
          tenant_id: string
          tipo: string
          unidad: string | null
          valor: number | null
          verificacion: string | null
          verificado: boolean
        }
        Insert: {
          bloque_dueno?: number | null
          bloques_referencia?: number[]
          clave: string
          conflicto?: string | null
          created_at?: string
          enunciado: string
          estado?: string
          extracto: string
          fuente_detalle: string
          fuente_id: string
          fuente_tipo: string
          grupo_conflicto?: string | null
          id?: string
          libro_id: string
          periodo?: string | null
          rango_fuente: string
          tenant_id: string
          tipo: string
          unidad?: string | null
          valor?: number | null
          verificacion?: string | null
          verificado?: boolean
        }
        Update: {
          bloque_dueno?: number | null
          bloques_referencia?: number[]
          clave?: string
          conflicto?: string | null
          created_at?: string
          enunciado?: string
          estado?: string
          extracto?: string
          fuente_detalle?: string
          fuente_id?: string
          fuente_tipo?: string
          grupo_conflicto?: string | null
          id?: string
          libro_id?: string
          periodo?: string | null
          rango_fuente?: string
          tenant_id?: string
          tipo?: string
          unidad?: string | null
          valor?: number | null
          verificacion?: string | null
          verificado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "hechos_libro_id_fkey"
            columns: ["libro_id"]
            isOneToOne: false
            referencedRelation: "libros_hechos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hechos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitaciones: {
        Row: {
          creada_por: string | null
          created_at: string
          expira_en: string
          id: string
          perfil_id: string
          tenant_id: string
          token_hash: string
          usada_en: string | null
        }
        Insert: {
          creada_por?: string | null
          created_at?: string
          expira_en: string
          id?: string
          perfil_id: string
          tenant_id: string
          token_hash: string
          usada_en?: string | null
        }
        Update: {
          creada_por?: string | null
          created_at?: string
          expira_en?: string
          id?: string
          perfil_id?: string
          tenant_id?: string
          token_hash?: string
          usada_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitaciones_creada_por_fkey"
            columns: ["creada_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitaciones_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      libros_hechos: {
        Row: {
          costo_usd: number
          creado_por: string | null
          created_at: string
          duracion_ms: number
          error: string | null
          estado: string
          huella: string | null
          id: string
          llamadas: number
          modelo: string | null
          prompt_version: string | null
          reporte_id: string
          resumen: Json
          tenant_id: string
          terminado_en: string | null
          tokens_entrada: number
          tokens_entrada_cache_escritura: number
          tokens_entrada_cache_lectura: number
          tokens_salida: number
        }
        Insert: {
          costo_usd?: number
          creado_por?: string | null
          created_at?: string
          duracion_ms?: number
          error?: string | null
          estado?: string
          huella?: string | null
          id?: string
          llamadas?: number
          modelo?: string | null
          prompt_version?: string | null
          reporte_id: string
          resumen?: Json
          tenant_id: string
          terminado_en?: string | null
          tokens_entrada?: number
          tokens_entrada_cache_escritura?: number
          tokens_entrada_cache_lectura?: number
          tokens_salida?: number
        }
        Update: {
          costo_usd?: number
          creado_por?: string | null
          created_at?: string
          duracion_ms?: number
          error?: string | null
          estado?: string
          huella?: string | null
          id?: string
          llamadas?: number
          modelo?: string | null
          prompt_version?: string | null
          reporte_id?: string
          resumen?: Json
          tenant_id?: string
          terminado_en?: string | null
          tokens_entrada?: number
          tokens_entrada_cache_escritura?: number
          tokens_entrada_cache_lectura?: number
          tokens_salida?: number
        }
        Relationships: [
          {
            foreignKeyName: "libros_hechos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libros_hechos_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libros_hechos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mapeo_export: {
        Row: {
          activo: boolean
          anio_offset: number | null
          celda: string
          celda_nota: string | null
          created_at: string
          datapoint_id: string | null
          etiqueta: string | null
          hoja: string
          id: string
          rubro_clave: string | null
        }
        Insert: {
          activo?: boolean
          anio_offset?: number | null
          celda: string
          celda_nota?: string | null
          created_at?: string
          datapoint_id?: string | null
          etiqueta?: string | null
          hoja: string
          id?: string
          rubro_clave?: string | null
        }
        Update: {
          activo?: boolean
          anio_offset?: number | null
          celda?: string
          celda_nota?: string | null
          created_at?: string
          datapoint_id?: string | null
          etiqueta?: string | null
          hoja?: string
          id?: string
          rubro_clave?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mapeo_export_datapoint_id_fkey"
            columns: ["datapoint_id"]
            isOneToOne: false
            referencedRelation: "datapoints_taxonomia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapeo_export_rubro_clave_fkey"
            columns: ["rubro_clave"]
            isOneToOne: false
            referencedRelation: "rubros_taxonomia"
            referencedColumns: ["clave"]
          },
        ]
      }
      mapeo_solicitud_datapoint: {
        Row: {
          created_at: string
          datapoint_id: string
          solicitud_id: string
        }
        Insert: {
          created_at?: string
          datapoint_id: string
          solicitud_id: string
        }
        Update: {
          created_at?: string
          datapoint_id?: string
          solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapeo_solicitud_datapoint_datapoint_id_fkey"
            columns: ["datapoint_id"]
            isOneToOne: false
            referencedRelation: "datapoints_taxonomia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapeo_solicitud_datapoint_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
        ]
      }
      objetivos: {
        Row: {
          activo: boolean
          alineacion_acuerdo_internacional: string | null
          ambito: string
          created_at: string
          descripcion: string | null
          hito_intermedio: string | null
          id: string
          meta: string | null
          metrica: string | null
          naturaleza: string
          nombre: string
          orden: number
          parte_entidad: string | null
          periodo_aplicacion: string | null
          periodo_base: string | null
          reporte_id: string
          tipo: string | null
          tipo_objetivo: string | null
        }
        Insert: {
          activo?: boolean
          alineacion_acuerdo_internacional?: string | null
          ambito: string
          created_at?: string
          descripcion?: string | null
          hito_intermedio?: string | null
          id?: string
          meta?: string | null
          metrica?: string | null
          naturaleza?: string
          nombre: string
          orden?: number
          parte_entidad?: string | null
          periodo_aplicacion?: string | null
          periodo_base?: string | null
          reporte_id: string
          tipo?: string | null
          tipo_objetivo?: string | null
        }
        Update: {
          activo?: boolean
          alineacion_acuerdo_internacional?: string | null
          ambito?: string
          created_at?: string
          descripcion?: string | null
          hito_intermedio?: string | null
          id?: string
          meta?: string | null
          metrica?: string | null
          naturaleza?: string
          nombre?: string
          orden?: number
          parte_entidad?: string | null
          periodo_aplicacion?: string | null
          periodo_base?: string | null
          reporte_id?: string
          tipo?: string | null
          tipo_objetivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objetivos_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
        ]
      }
      objetivos_detalle: {
        Row: {
          alcances_cubiertos: string | null
          analisis_tendencias: string | null
          bruto_neto: string | null
          created_at: string
          enfoque_descarbonizacion: string | null
          gases_cubiertos: string | null
          id: string
          metricas_supervision: string | null
          notas: string | null
          objetivo_id: string
          procesos_revision: string | null
          resultados: string | null
          revisiones: string | null
          updated_at: string
          validacion_tercero: string | null
        }
        Insert: {
          alcances_cubiertos?: string | null
          analisis_tendencias?: string | null
          bruto_neto?: string | null
          created_at?: string
          enfoque_descarbonizacion?: string | null
          gases_cubiertos?: string | null
          id?: string
          metricas_supervision?: string | null
          notas?: string | null
          objetivo_id: string
          procesos_revision?: string | null
          resultados?: string | null
          revisiones?: string | null
          updated_at?: string
          validacion_tercero?: string | null
        }
        Update: {
          alcances_cubiertos?: string | null
          analisis_tendencias?: string | null
          bruto_neto?: string | null
          created_at?: string
          enfoque_descarbonizacion?: string | null
          gases_cubiertos?: string | null
          id?: string
          metricas_supervision?: string | null
          notas?: string | null
          objetivo_id?: string
          procesos_revision?: string | null
          resultados?: string | null
          revisiones?: string | null
          updated_at?: string
          validacion_tercero?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objetivos_detalle_objetivo_id_fkey"
            columns: ["objetivo_id"]
            isOneToOne: true
            referencedRelation: "objetivos"
            referencedColumns: ["id"]
          },
        ]
      }
      observaciones_coherencia: {
        Row: {
          bloques_revisados: number
          costo_usd: number
          created_at: string
          descartadas: number
          documento_id: string
          duracion_ms: number
          error: string | null
          estado: string
          id: string
          modelo: string | null
          observaciones: Json
          origen: string
          prompt_version: string | null
          solicitado_por: string | null
          tenant_id: string
          terminado_en: string | null
          tokens_entrada: number
          tokens_entrada_cache_escritura: number
          tokens_entrada_cache_lectura: number
          tokens_salida: number
        }
        Insert: {
          bloques_revisados?: number
          costo_usd?: number
          created_at?: string
          descartadas?: number
          documento_id: string
          duracion_ms?: number
          error?: string | null
          estado?: string
          id?: string
          modelo?: string | null
          observaciones?: Json
          origen?: string
          prompt_version?: string | null
          solicitado_por?: string | null
          tenant_id: string
          terminado_en?: string | null
          tokens_entrada?: number
          tokens_entrada_cache_escritura?: number
          tokens_entrada_cache_lectura?: number
          tokens_salida?: number
        }
        Update: {
          bloques_revisados?: number
          costo_usd?: number
          created_at?: string
          descartadas?: number
          documento_id?: string
          duracion_ms?: number
          error?: string | null
          estado?: string
          id?: string
          modelo?: string | null
          observaciones?: Json
          origen?: string
          prompt_version?: string | null
          solicitado_por?: string | null
          tenant_id?: string
          terminado_en?: string | null
          tokens_entrada?: number
          tokens_entrada_cache_escritura?: number
          tokens_entrada_cache_lectura?: number
          tokens_salida?: number
        }
        Relationships: [
          {
            foreignKeyName: "observaciones_coherencia_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos_generados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observaciones_coherencia_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observaciones_coherencia_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_emisor: {
        Row: {
          actualizado_en: string | null
          actualizado_por: string | null
          cadena_valor: Json
          carta_cargo: string | null
          carta_firmante: string | null
          carta_texto: string | null
          created_at: string
          denominacion_formal: string | null
          entidad_que_informa: string | null
          forma_de_referencia: string | null
          gobierno_texto: string | null
          hitos_corporativos: Json
          hitos_sostenibilidad: Json
          horizontes: Json
          id: string
          matriz_riesgos: Json
          modelo_negocio: string | null
          nombre_corto: string | null
          organigrama_path: string | null
          perimetro: string | null
          proceso_materialidad: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actualizado_en?: string | null
          actualizado_por?: string | null
          cadena_valor?: Json
          carta_cargo?: string | null
          carta_firmante?: string | null
          carta_texto?: string | null
          created_at?: string
          denominacion_formal?: string | null
          entidad_que_informa?: string | null
          forma_de_referencia?: string | null
          gobierno_texto?: string | null
          hitos_corporativos?: Json
          hitos_sostenibilidad?: Json
          horizontes?: Json
          id?: string
          matriz_riesgos?: Json
          modelo_negocio?: string | null
          nombre_corto?: string | null
          organigrama_path?: string | null
          perimetro?: string | null
          proceso_materialidad?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actualizado_en?: string | null
          actualizado_por?: string | null
          cadena_valor?: Json
          carta_cargo?: string | null
          carta_firmante?: string | null
          carta_texto?: string | null
          created_at?: string
          denominacion_formal?: string | null
          entidad_que_informa?: string | null
          forma_de_referencia?: string | null
          gobierno_texto?: string | null
          hitos_corporativos?: Json
          hitos_sostenibilidad?: Json
          horizontes?: Json
          id?: string
          matriz_riesgos?: Json
          modelo_negocio?: string | null
          nombre_corto?: string | null
          organigrama_path?: string | null
          perimetro?: string | null
          proceso_materialidad?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_emisor_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_emisor_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_emisor_adjuntos: {
        Row: {
          archivo_path: string
          created_at: string
          id: string
          mime: string | null
          nombre_original: string
          seccion: string
          subido_por: string | null
          tamano: number | null
          tenant_id: string
        }
        Insert: {
          archivo_path: string
          created_at?: string
          id?: string
          mime?: string | null
          nombre_original: string
          seccion: string
          subido_por?: string | null
          tamano?: number | null
          tenant_id: string
        }
        Update: {
          archivo_path?: string
          created_at?: string
          id?: string
          mime?: string | null
          nombre_original?: string
          seccion?: string
          subido_por?: string | null
          tamano?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_emisor_adjuntos_subido_por_fkey"
            columns: ["subido_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_emisor_adjuntos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_emisor_adjuntos_contenido: {
        Row: {
          adjunto_id: string
          archivo_path: string
          bytes: number | null
          contenido: Json | null
          costo_usd: number
          created_at: string
          error: string | null
          estado: Database["public"]["Enums"]["estado_lectura"]
          hojas: number | null
          id: string
          intentos: number
          mensaje: string | null
          modelo: string | null
          nombre_original: string
          paginas: number | null
          procesado_en: string | null
          seccion: string
          tenant_id: string
          tipo: string | null
          tokens_entrada: number
          tokens_salida: number
          truncado: boolean
        }
        Insert: {
          adjunto_id: string
          archivo_path: string
          bytes?: number | null
          contenido?: Json | null
          costo_usd?: number
          created_at?: string
          error?: string | null
          estado?: Database["public"]["Enums"]["estado_lectura"]
          hojas?: number | null
          id?: string
          intentos?: number
          mensaje?: string | null
          modelo?: string | null
          nombre_original: string
          paginas?: number | null
          procesado_en?: string | null
          seccion: string
          tenant_id: string
          tipo?: string | null
          tokens_entrada?: number
          tokens_salida?: number
          truncado?: boolean
        }
        Update: {
          adjunto_id?: string
          archivo_path?: string
          bytes?: number | null
          contenido?: Json | null
          costo_usd?: number
          created_at?: string
          error?: string | null
          estado?: Database["public"]["Enums"]["estado_lectura"]
          hojas?: number | null
          id?: string
          intentos?: number
          mensaje?: string | null
          modelo?: string | null
          nombre_original?: string
          paginas?: number | null
          procesado_en?: string | null
          seccion?: string
          tenant_id?: string
          tipo?: string | null
          tokens_entrada?: number
          tokens_salida?: number
          truncado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "perfil_emisor_adjuntos_contenido_adjunto_id_fkey"
            columns: ["adjunto_id"]
            isOneToOne: true
            referencedRelation: "perfil_emisor_adjuntos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_emisor_adjuntos_contenido_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles_usuario: {
        Row: {
          activo: boolean
          area: string | null
          created_at: string
          debe_cambiar_password: boolean
          email: string
          id: string
          nombre: string
          recibe_resumen_diario: boolean
          rol: Database["public"]["Enums"]["rol_usuario"]
          tenant_id: string | null
        }
        Insert: {
          activo?: boolean
          area?: string | null
          created_at?: string
          debe_cambiar_password?: boolean
          email: string
          id: string
          nombre: string
          recibe_resumen_diario?: boolean
          rol: Database["public"]["Enums"]["rol_usuario"]
          tenant_id?: string | null
        }
        Update: {
          activo?: boolean
          area?: string | null
          created_at?: string
          debe_cambiar_password?: boolean
          email?: string
          id?: string
          nombre?: string
          recibe_resumen_diario?: boolean
          rol?: Database["public"]["Enums"]["rol_usuario"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_usuario_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plantilla_solicitudes: {
        Row: {
          area_asignada: string | null
          created_at: string
          datapoint_ids: string[]
          descripcion: string | null
          es_cuantitativa: boolean
          id: string
          orden: number
          plantilla_id: string
          rubro_taxonomia: string | null
          titulo: string
          unidad_esperada: string | null
        }
        Insert: {
          area_asignada?: string | null
          created_at?: string
          datapoint_ids?: string[]
          descripcion?: string | null
          es_cuantitativa?: boolean
          id?: string
          orden?: number
          plantilla_id: string
          rubro_taxonomia?: string | null
          titulo: string
          unidad_esperada?: string | null
        }
        Update: {
          area_asignada?: string | null
          created_at?: string
          datapoint_ids?: string[]
          descripcion?: string | null
          es_cuantitativa?: boolean
          id?: string
          orden?: number
          plantilla_id?: string
          rubro_taxonomia?: string | null
          titulo?: string
          unidad_esperada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plantilla_solicitudes_plantilla_id_fkey"
            columns: ["plantilla_id"]
            isOneToOne: false
            referencedRelation: "plantillas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantilla_solicitudes_rubro_taxonomia_fkey"
            columns: ["rubro_taxonomia"]
            isOneToOne: false
            referencedRelation: "rubros_taxonomia"
            referencedColumns: ["clave"]
          },
        ]
      }
      plantillas: {
        Row: {
          creado_por: string | null
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_clima: {
        Row: {
          activo: boolean
          concentracion: string | null
          created_at: string
          descripcion: string | null
          horizontes: string[]
          id: string
          impacto: number | null
          impactos_potenciales: string | null
          nivel: string | null
          nombre: string
          orden: number
          probabilidad: number | null
          reporte_id: string
          respuesta: string | null
          severidad: number | null
          tipo: string
        }
        Insert: {
          activo?: boolean
          concentracion?: string | null
          created_at?: string
          descripcion?: string | null
          horizontes?: string[]
          id?: string
          impacto?: number | null
          impactos_potenciales?: string | null
          nivel?: string | null
          nombre: string
          orden?: number
          probabilidad?: number | null
          reporte_id: string
          respuesta?: string | null
          severidad?: number | null
          tipo: string
        }
        Update: {
          activo?: boolean
          concentracion?: string | null
          created_at?: string
          descripcion?: string | null
          horizontes?: string[]
          id?: string
          impacto?: number | null
          impactos_potenciales?: string | null
          nivel?: string | null
          nombre?: string
          orden?: number
          probabilidad?: number | null
          reporte_id?: string
          respuesta?: string | null
          severidad?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_clima_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_clima_valores: {
        Row: {
          cantidad_activos: number | null
          capital_financiacion: number | null
          capital_gasto: number | null
          capital_inversion: number | null
          capturado_por: string | null
          created_at: string
          ejercicio: number
          id: string
          notas: string | null
          porcentaje: number | null
          registro_id: string
        }
        Insert: {
          cantidad_activos?: number | null
          capital_financiacion?: number | null
          capital_gasto?: number | null
          capital_inversion?: number | null
          capturado_por?: string | null
          created_at?: string
          ejercicio: number
          id?: string
          notas?: string | null
          porcentaje?: number | null
          registro_id: string
        }
        Update: {
          cantidad_activos?: number | null
          capital_financiacion?: number | null
          capital_gasto?: number | null
          capital_inversion?: number | null
          capturado_por?: string | null
          created_at?: string
          ejercicio?: number
          id?: string
          notas?: string | null
          porcentaje?: number | null
          registro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_clima_valores_capturado_por_fkey"
            columns: ["capturado_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_clima_valores_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros_clima"
            referencedColumns: ["id"]
          },
        ]
      }
      reportes: {
        Row: {
          alivios: Json
          anio_adopcion: number | null
          created_at: string
          ejercicio: number
          estado: Database["public"]["Enums"]["estado_reporte"]
          fecha_congelamiento: string | null
          id: string
          nombre: string
          tenant_id: string
        }
        Insert: {
          alivios?: Json
          anio_adopcion?: number | null
          created_at?: string
          ejercicio: number
          estado?: Database["public"]["Enums"]["estado_reporte"]
          fecha_congelamiento?: string | null
          id?: string
          nombre: string
          tenant_id: string
        }
        Update: {
          alivios?: Json
          anio_adopcion?: number | null
          created_at?: string
          ejercicio?: number
          estado?: Database["public"]["Enums"]["estado_reporte"]
          fecha_congelamiento?: string | null
          id?: string
          nombre?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reportes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rubros_taxonomia: {
        Row: {
          activo: boolean
          clave: string
          created_at: string
          etiqueta: string
          grupo: string
          orden: number
        }
        Insert: {
          activo?: boolean
          clave: string
          created_at?: string
          etiqueta: string
          grupo: string
          orden?: number
        }
        Update: {
          activo?: boolean
          clave?: string
          created_at?: string
          etiqueta?: string
          grupo?: string
          orden?: number
        }
        Relationships: []
      }
      solicitudes: {
        Row: {
          area_asignada: string | null
          created_at: string
          declinada: boolean
          desactivada: boolean
          descripcion: string | null
          es_cuantitativa: boolean
          estado: Database["public"]["Enums"]["estado_solicitud"]
          fecha_limite: string | null
          grupo_difusion_id: string | null
          id: string
          nota_alcance: string | null
          orden: number
          origen: Database["public"]["Enums"]["origen_solicitud"]
          reporte_id: string
          responsable_cliente_id: string | null
          responsable_cliente_texto: string | null
          responsable_irstrat_id: string | null
          rubro_clave: string | null
          rubro_taxonomia: string | null
          titulo: string
          unidad_esperada: string | null
          vb_area_fecha: string | null
          vb_area_por: string | null
        }
        Insert: {
          area_asignada?: string | null
          created_at?: string
          declinada?: boolean
          desactivada?: boolean
          descripcion?: string | null
          es_cuantitativa?: boolean
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          fecha_limite?: string | null
          grupo_difusion_id?: string | null
          id?: string
          nota_alcance?: string | null
          orden?: number
          origen?: Database["public"]["Enums"]["origen_solicitud"]
          reporte_id: string
          responsable_cliente_id?: string | null
          responsable_cliente_texto?: string | null
          responsable_irstrat_id?: string | null
          rubro_clave?: string | null
          rubro_taxonomia?: string | null
          titulo: string
          unidad_esperada?: string | null
          vb_area_fecha?: string | null
          vb_area_por?: string | null
        }
        Update: {
          area_asignada?: string | null
          created_at?: string
          declinada?: boolean
          desactivada?: boolean
          descripcion?: string | null
          es_cuantitativa?: boolean
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          fecha_limite?: string | null
          grupo_difusion_id?: string | null
          id?: string
          nota_alcance?: string | null
          orden?: number
          origen?: Database["public"]["Enums"]["origen_solicitud"]
          reporte_id?: string
          responsable_cliente_id?: string | null
          responsable_cliente_texto?: string | null
          responsable_irstrat_id?: string | null
          rubro_clave?: string | null
          rubro_taxonomia?: string | null
          titulo?: string
          unidad_esperada?: string | null
          vb_area_fecha?: string | null
          vb_area_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "reportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_responsable_cliente_id_fkey"
            columns: ["responsable_cliente_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_responsable_irstrat_id_fkey"
            columns: ["responsable_irstrat_id"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_rubro_taxonomia_fkey"
            columns: ["rubro_taxonomia"]
            isOneToOne: false
            referencedRelation: "rubros_taxonomia"
            referencedColumns: ["clave"]
          },
          {
            foreignKeyName: "solicitudes_vb_area_por_fkey"
            columns: ["vb_area_por"]
            isOneToOne: false
            referencedRelation: "perfiles_usuario"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_recordatorios: {
        Row: {
          activo: boolean
          created_at: string
          dias_antes: number
          id: string
          solicitud_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          dias_antes: number
          id?: string
          solicitud_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          dias_antes?: number
          id?: string
          solicitud_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_recordatorios_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
        ]
      }
      sugerencias_captura: {
        Row: {
          candidatos: Json
          cita: string | null
          cobertura: string | null
          confianza: string | null
          contenido_id: string
          conversion: Json | null
          costo_usd: number
          created_at: string
          decidido_en: string | null
          decidido_por: string | null
          error: string | null
          estado: Database["public"]["Enums"]["estado_sugerencia"]
          evidencia_id: string
          evidencia_version: number
          extracto: string | null
          extracto_final: string | null
          fuente: Json | null
          id: string
          modelo: string | null
          motivo: string | null
          motivo_rechazo: string | null
          periodo: string | null
          prompt_version: string | null
          regenerada: boolean
          segunda_opinion: Json | null
          solicitud_id: string
          tenant_id: string
          tipo: string
          tokens_entrada: number
          tokens_salida: number
          unidad: string | null
          unidad_final: string | null
          valor: number | null
          valor_final: number | null
        }
        Insert: {
          candidatos?: Json
          cita?: string | null
          cobertura?: string | null
          confianza?: string | null
          contenido_id: string
          conversion?: Json | null
          costo_usd?: number
          created_at?: string
          decidido_en?: string | null
          decidido_por?: string | null
          error?: string | null
          estado?: Database["public"]["Enums"]["estado_sugerencia"]
          evidencia_id: string
          evidencia_version: number
          extracto?: string | null
          extracto_final?: string | null
          fuente?: Json | null
          id?: string
          modelo?: string | null
          motivo?: string | null
          motivo_rechazo?: string | null
          periodo?: string | null
          prompt_version?: string | null
          regenerada?: boolean
          segunda_opinion?: Json | null
          solicitud_id: string
          tenant_id: string
          tipo: string
          tokens_entrada?: number
          tokens_salida?: number
          unidad?: string | null
          unidad_final?: string | null
          valor?: number | null
          valor_final?: number | null
        }
        Update: {
          candidatos?: Json
          cita?: string | null
          cobertura?: string | null
          confianza?: string | null
          contenido_id?: string
          conversion?: Json | null
          costo_usd?: number
          created_at?: string
          decidido_en?: string | null
          decidido_por?: string | null
          error?: string | null
          estado?: Database["public"]["Enums"]["estado_sugerencia"]
          evidencia_id?: string
          evidencia_version?: number
          extracto?: string | null
          extracto_final?: string | null
          fuente?: Json | null
          id?: string
          modelo?: string | null
          motivo?: string | null
          motivo_rechazo?: string | null
          periodo?: string | null
          prompt_version?: string | null
          regenerada?: boolean
          segunda_opinion?: Json | null
          solicitud_id?: string
          tenant_id?: string
          tipo?: string
          tokens_entrada?: number
          tokens_salida?: number
          unidad?: string | null
          unidad_final?: string | null
          valor?: number | null
          valor_final?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sugerencias_captura_contenido_id_fkey"
            columns: ["contenido_id"]
            isOneToOne: false
            referencedRelation: "evidencias_contenido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugerencias_captura_evidencia_id_fkey"
            columns: ["evidencia_id"]
            isOneToOne: false
            referencedRelation: "evidencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugerencias_captura_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugerencias_captura_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          activo: boolean
          created_at: string
          es_demo: boolean
          generaciones_mes_max: number
          generador_activo: boolean
          id: string
          lectura_evidencias_activa: boolean
          lecturas_mes_max: number
          logo_url: string | null
          nombre: string
          prefijo_folio: string
          slug: string
          staff_puede_cargar: boolean
          vitrina_habilitada: boolean
        }
        Insert: {
          activo?: boolean
          created_at?: string
          es_demo?: boolean
          generaciones_mes_max?: number
          generador_activo?: boolean
          id?: string
          lectura_evidencias_activa?: boolean
          lecturas_mes_max?: number
          logo_url?: string | null
          nombre: string
          prefijo_folio: string
          slug: string
          staff_puede_cargar?: boolean
          vitrina_habilitada?: boolean
        }
        Update: {
          activo?: boolean
          created_at?: string
          es_demo?: boolean
          generaciones_mes_max?: number
          generador_activo?: boolean
          id?: string
          lectura_evidencias_activa?: boolean
          lecturas_mes_max?: number
          logo_url?: string | null
          nombre?: string
          prefijo_folio?: string
          slug?: string
          staff_puede_cargar?: boolean
          vitrina_habilitada?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_aplicar_barrera_auditor: { Args: never; Returns: number }
      fn_current_area: { Args: never; Returns: string }
      fn_current_rol: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      fn_current_tenant: { Args: never; Returns: string }
      fn_decidir_sugerencia: {
        Args: {
          p_accion: string
          p_extracto?: string
          p_motivo?: string
          p_periodo?: string
          p_sugerencia_id: string
          p_unidad?: string
          p_valor?: number
        }
        Returns: Json
      }
      fn_es_de_su_area: { Args: { p_solicitud_id: string }; Returns: boolean }
      fn_es_jefe_de_area: { Args: { p_solicitud_id: string }; Returns: boolean }
      fn_gestiona_recordatorios: {
        Args: { p_solicitud_id: string }
        Returns: boolean
      }
      fn_is_admin_cliente: { Args: never; Returns: boolean }
      fn_is_admin_irstrat: { Args: never; Returns: boolean }
      fn_is_auditor: { Args: never; Returns: boolean }
      fn_is_staff: { Args: never; Returns: boolean }
      fn_log_correo: {
        Args: {
          p_accion: string
          p_detalle: Json
          p_entidad_id: string
          p_tenant_id: string
          p_usuario_id: string
        }
        Returns: string
      }
      fn_log_evento: {
        Args: {
          p_accion: string
          p_detalle: Json
          p_entidad: string
          p_entidad_id: string
          p_tenant_id: string
          p_usuario_id: string
        }
        Returns: string
      }
      fn_perfil_es_del_tenant: {
        Args: { p_perfil: string; p_tenant: string }
        Returns: boolean
      }
      fn_puede_decidir_sugerencia: {
        Args: { p_solicitud_id: string }
        Returns: boolean
      }
      fn_puede_ver_solicitud: {
        Args: { p_solicitud_id: string }
        Returns: boolean
      }
      fn_renombrar_area: {
        Args: { p_area_id: string; p_nombre: string }
        Returns: Json
      }
      fn_reporte_estado_de_solicitud: {
        Args: { p_solicitud_id: string }
        Returns: Database["public"]["Enums"]["estado_reporte"]
      }
      fn_set_resumen_diario: { Args: { p_recibir: boolean }; Returns: boolean }
      fn_tenant_de_solicitud: {
        Args: { p_solicitud_id: string }
        Returns: string
      }
    }
    Enums: {
      estado_lectura:
        | "pendiente"
        | "procesando"
        | "extraido"
        | "error"
        | "no_soportado"
        | "omitido"
      estado_reporte: "activo" | "congelado"
      estado_solicitud:
        | "pendiente"
        | "solicitado"
        | "recibido"
        | "en_revision"
        | "observaciones"
        | "validado"
        | "congelado"
      estado_sugerencia:
        | "sugerida"
        | "sin_hallazgo"
        | "confirmada"
        | "corregida"
        | "rechazada"
        | "obsoleta"
        | "fallida"
      norma_niif: "S1" | "S2"
      objeto_comentario_auditor:
        | "solicitud"
        | "registro_clima"
        | "objetivo"
        | "cuestionario"
      origen_solicitud: "irstrat" | "cliente"
      pilar_niif: "gobernanza" | "estrategia" | "riesgos" | "metricas"
      rol_usuario:
        | "cliente"
        | "coordinador"
        | "analista"
        | "admin"
        | "admin_cliente"
        | "jefe_area"
        | "auditor"
      tipo_actividad_auditor:
        | "inicio_sesion"
        | "vista_matriz"
        | "vista_cobertura"
        | "vista_solicitud"
        | "vista_evidencia"
        | "descarga_evidencia"
        | "descarga_excel"
        | "comentario"
        | "vista_taxonomia"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_lectura: [
        "pendiente",
        "procesando",
        "extraido",
        "error",
        "no_soportado",
        "omitido",
      ],
      estado_reporte: ["activo", "congelado"],
      estado_solicitud: [
        "pendiente",
        "solicitado",
        "recibido",
        "en_revision",
        "observaciones",
        "validado",
        "congelado",
      ],
      estado_sugerencia: [
        "sugerida",
        "sin_hallazgo",
        "confirmada",
        "corregida",
        "rechazada",
        "obsoleta",
        "fallida",
      ],
      norma_niif: ["S1", "S2"],
      objeto_comentario_auditor: [
        "solicitud",
        "registro_clima",
        "objetivo",
        "cuestionario",
      ],
      origen_solicitud: ["irstrat", "cliente"],
      pilar_niif: ["gobernanza", "estrategia", "riesgos", "metricas"],
      rol_usuario: [
        "cliente",
        "coordinador",
        "analista",
        "admin",
        "admin_cliente",
        "jefe_area",
        "auditor",
      ],
      tipo_actividad_auditor: [
        "inicio_sesion",
        "vista_matriz",
        "vista_cobertura",
        "vista_solicitud",
        "vista_evidencia",
        "descarga_evidencia",
        "descarga_excel",
        "comentario",
        "vista_taxonomia",
      ],
    },
  },
} as const
