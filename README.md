# SatRC v4.0

**Sistema de Alerta Temprana y Riesgos Climáticos**

Desarrollado por Cáritas Pastoral Social de la Arquidiócesis de Tulancingo.

## Descripción

PWA institucional interna (NO pública) que emite niveles de alerta
climática 1–4 por localidad y notifica a supervisores de zona.

- **Cobertura**: 405 localidades en Hidalgo, Sierra Norte de Puebla y
  norte de Veracruz.
- **Arquitectura**: 2 capas (autónoma + supervisión humana).
- **Stack**: GitHub + Vercel + Supabase + Groq API + GitHub Actions.

## Estado del proyecto

- [x] Sesión 0: Auditoría del dataset (405 localidades verificadas)
- [ ] Sesión 1: Preprocesamiento estático (§6.1)
- [ ] Sesión 2: Pipeline de ingesta y consenso (§6.2)
- [ ] Sesión 3: Evaluación por localidad y reglas multivectoriales
- [ ] Sesión 4: Orquestación y persistencia
- [ ] Sesión 5: Verificación diferida
- [ ] Sesión 6+: Módulos secundarios

## Estructura
