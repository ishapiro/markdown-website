<template>
  <div class="relative h-full">
    <div
      ref="editorRoot"
      class="h-full overflow-auto bg-vault-bg font-mono text-vault-text outline-none"
      :style="{ fontSize: fontSize }"
    />

    <!-- Debug: shown when props have content but CodeMirror is empty -->
    <div
      v-if="debugMismatch"
      class="absolute top-2 right-2 z-50 flex items-center gap-2"
    >
      <span class="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-mono">editor empty</span>
      <button
        class="text-[10px] bg-yellow-400 text-black px-2 py-0.5 rounded font-semibold"
        @click="showDebugPanel = true"
      >Debug</button>
    </div>

    <!-- Debug panel -->
    <div
      v-if="showDebugPanel"
      class="absolute inset-0 z-50 bg-vault-bg/95 overflow-y-auto p-4 font-mono text-[11px]"
    >
      <div class="flex items-center justify-between mb-3">
        <span class="font-bold text-red-500">MarkdownEditor Debug</span>
        <button class="text-vault-muted hover:text-vault-text" @click="showDebugPanel = false">✕ Close</button>
      </div>
      <div class="space-y-2">
        <div v-for="(evt, i) in debugEvents" :key="i" class="border border-vault-border rounded p-2">
          <div class="flex gap-3 mb-1">
            <span class="font-bold" :class="evt.type.startsWith('warn') ? 'text-red-400' : 'text-vault-accent'">{{ evt.type }}</span>
            <span class="text-vault-faint">+{{ evt.ms }}ms</span>
          </div>
          <div v-for="(val, key) in evt.data" :key="key" class="text-vault-muted pl-2">
            <span class="text-vault-text">{{ key }}:</span> {{ val }}
          </div>
        </div>
        <div v-if="!debugEvents.length" class="text-vault-faint">No events recorded yet.</div>
      </div>
      <button
        class="mt-4 text-xs px-3 py-1 border border-vault-border rounded text-vault-muted hover:bg-vault-surface"
        @click="debugEvents = []; showDebugPanel = false"
      >Clear &amp; Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, drawSelection, keymap } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'

const props = withDefaults(
  defineProps<{
    modelValue: string
    externalCursorPos?: number
    fontSize?: string
    lineWrap?: boolean
  }>(),
  { fontSize: '0.875rem', lineWrap: true },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'selectionChange', payload: { text: string } | null): void
  (e: 'selectionMeta', payload: { from: number; to: number; empty: boolean }): void
}>()

const editorRoot = ref<HTMLElement | null>(null)
let view: EditorView | null = null
let lineWrapCompartment: Compartment | null = null
let isUpdatingFromView = false

// ── Debug tracking ──────────────────────────────────────────────────────────
interface DebugEvent {
  type: string
  ms: number
  data: Record<string, unknown>
}
const debugEvents = ref<DebugEvent[]>([])
const debugMismatch = ref(false)
const showDebugPanel = ref(false)
let mountedAt = 0

function rec(type: string, data: Record<string, unknown> = {}) {
  debugEvents.value.push({ type, ms: mountedAt ? Date.now() - mountedAt : 0, data })
}

function checkMismatch() {
  const docLen = view?.state.doc.length ?? -1
  const propLen = (props.modelValue ?? '').length
  const mismatch = propLen > 0 && docLen === 0
  if (mismatch && !debugMismatch.value) {
    rec('warn:mismatch-detected', {
      props_modelValue_length: propLen,
      view_doc_length: docLen,
      view_initialized: view !== null,
    })
  }
  debugMismatch.value = mismatch
}
// ────────────────────────────────────────────────────────────────────────────

onMounted(() => {
  mountedAt = Date.now()

  if (!editorRoot.value) {
    rec('warn:mount-no-root', { props_modelValue_length: (props.modelValue ?? '').length })
    return
  }

  rec('mount', {
    props_modelValue_length: (props.modelValue ?? '').length,
    props_modelValue_preview: (props.modelValue ?? '').slice(0, 60) || '(empty)',
  })

  lineWrapCompartment = new Compartment()

  const state = EditorState.create({
    doc: props.modelValue || '',
    extensions: [
      drawSelection(),
      lineWrapCompartment.of(props.lineWrap ? [EditorView.lineWrapping] : []),
      EditorView.editorAttributes.of({ spellcheck: 'true', autocorrect: 'on', autocapitalize: 'off' }),
      EditorView.contentAttributes.of({ spellcheck: 'true' }),
      keymap.of(defaultKeymap),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          isUpdatingFromView = true
          emit('update:modelValue', update.state.doc.toString())
          isUpdatingFromView = false
        }
        if (update.selectionSet) {
          const sel = update.state.selection.main
          emit('selectionMeta', { from: sel.from, to: sel.to, empty: sel.empty })
          if (!sel.empty) {
            emit('selectionChange', { text: update.state.doc.sliceString(sel.from, sel.to) })
          } else {
            emit('selectionChange', null)
          }
        }
      }),
      EditorView.theme({
        '&.cm-editor': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
          fontSize: 'inherit',
          outline: 'none',
          backgroundColor: 'transparent',
          height: '100%',
        },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': { padding: '0.75rem 1rem', color: '#222222', minHeight: '100%' },
        '.cm-line': { lineHeight: '1.6' },
        '.cm-selectionBackground': { backgroundColor: 'rgba(120, 82, 238, 0.18)' },
        '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(120, 82, 238, 0.25)' },
        '.cm-cursor': { borderLeftColor: '#7852ee' },
        '.cm-gutters': { display: 'none' },
      }),
    ],
  })

  view = new EditorView({ state, parent: editorRoot.value })

  rec('view-created', {
    initial_doc_length: view.state.doc.length,
    props_modelValue_length: (props.modelValue ?? '').length,
  })

  nextTick(() => checkMismatch())
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

watch(
  () => props.modelValue,
  (value) => {
    rec('watch-fired', {
      view_initialized: view !== null,
      isUpdatingFromView,
      value_length: (value ?? '').length,
      current_doc_length: view?.state.doc.length ?? -1,
    })

    if (!view || isUpdatingFromView) {
      rec('warn:watch-skipped', {
        reason: !view ? 'view_null' : 'isUpdatingFromView',
      })
      return
    }
    const current = view.state.doc.toString()
    if ((value || '') !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value || '' },
        effects: lineWrapCompartment?.reconfigure(props.lineWrap ? [EditorView.lineWrapping] : []),
      })
      rec('dispatch-executed', {
        inserted_length: (value ?? '').length,
        replaced_length: current.length,
      })
    } else {
      rec('watch-no-change-needed', { length: (value ?? '').length })
    }

    nextTick(() => checkMismatch())
  },
)

watch(
  () => props.externalCursorPos,
  (pos) => {
    if (!view || typeof pos !== 'number') return
    const clamped = Math.max(0, Math.min(pos, view.state.doc.length))
    view.focus()
    view.dispatch({ selection: { anchor: clamped }, scrollIntoView: true })
  },
)

watch(
  () => props.lineWrap,
  (wrap) => {
    if (view && lineWrapCompartment) {
      view.dispatch({ effects: lineWrapCompartment.reconfigure(wrap ? [EditorView.lineWrapping] : []) })
    }
  },
)
</script>
