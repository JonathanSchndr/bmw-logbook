<template>
  <div class="relative w-full">
    <UInput
      v-model="inputValue"
      :placeholder="placeholder"
      :class="inputClass"
      autocomplete="off"
      @input="onInput"
      @keydown.down.prevent="moveDown"
      @keydown.up.prevent="moveUp"
      @keydown.enter.prevent="selectHighlighted"
      @keydown.escape="close"
      @blur="onBlur"
      @focus="onFocus"
    />

    <!-- Suggestions dropdown -->
    <ul
      v-if="open && suggestions.length"
      class="absolute z-50 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
    >
      <li
        v-for="(s, i) in suggestions"
        :key="i"
        class="px-3 py-2 text-sm cursor-pointer flex items-start gap-2"
        :class="i === highlighted
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'"
        @mousedown.prevent="select(s)"
      >
        <UIcon name="i-heroicons-map-pin" class="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-400" />
        <span class="truncate">{{ s.shortName }}</span>
      </li>

      <li v-if="loading" class="px-3 py-2 text-sm text-gray-400 flex items-center gap-2">
        <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
        Searching...
      </li>
    </ul>

    <div v-if="open && loading && !suggestions.length" class="absolute z-50 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400 flex items-center gap-2">
      <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
      Searching...
    </div>
  </div>
</template>

<script setup lang="ts">
interface Suggestion {
  lat: number
  lng: number
  displayName: string
  shortName: string
}

interface Props {
  modelValue: string
  placeholder?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Enter address...',
  class: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'select': [suggestion: Suggestion]
}>()

const inputClass = computed(() => `w-full ${props.class}`)
const inputValue = ref(props.modelValue)
const suggestions = ref<Suggestion[]>([])
const loading = ref(false)
const open = ref(false)
const highlighted = ref(-1)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.modelValue, (val) => {
  if (val !== inputValue.value) inputValue.value = val
})

function onInput() {
  // Don't emit to parent on every keystroke — only on select/blur
  // This prevents parent re-renders while typing
  highlighted.value = -1

  if (debounceTimer) clearTimeout(debounceTimer)
  if (inputValue.value.length < 3) {
    suggestions.value = []
    open.value = false
    return
  }

  debounceTimer = setTimeout(search, 400)
}

async function search() {
  loading.value = true
  open.value = true
  try {
    const results = await $fetch<Suggestion[]>(`/api/geocode?q=${encodeURIComponent(inputValue.value)}&limit=6`)
    suggestions.value = Array.isArray(results) ? results : []
  } catch {
    suggestions.value = []
  } finally {
    loading.value = false
  }
}

function select(s: Suggestion) {
  inputValue.value = s.shortName
  emit('update:modelValue', s.shortName)
  emit('select', s)
  close()
}

function selectHighlighted() {
  if (highlighted.value >= 0 && suggestions.value[highlighted.value]) {
    select(suggestions.value[highlighted.value])
  }
}

function moveDown() {
  if (highlighted.value < suggestions.value.length - 1) highlighted.value++
}

function moveUp() {
  if (highlighted.value > 0) highlighted.value--
}

function close() {
  open.value = false
  highlighted.value = -1
}

function onFocus() {
  if (suggestions.value.length) open.value = true
}

function onBlur() {
  // Sync final typed value to parent when leaving the field
  emit('update:modelValue', inputValue.value)
  // Small delay so mousedown on suggestion fires first
  setTimeout(close, 150)
}
</script>
