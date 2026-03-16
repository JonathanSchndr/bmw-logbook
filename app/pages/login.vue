<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
    <div class="w-full max-w-sm">
      <!-- Logo -->
      <div class="flex justify-center mb-8">
        <div class="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
          <UIcon name="i-mdi-car" class="h-8 w-8 text-white" />
        </div>
      </div>

      <UCard>
        <template #content>
          <div class="space-y-6 p-2">
            <div class="text-center">
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">BMW Logbook</h1>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter your password to continue</p>
            </div>

            <form class="space-y-4" @submit.prevent="login">
              <UFormField label="Password">
                <UInput
                  v-model="password"
                  type="password"
                  placeholder="Password"
                  autocomplete="current-password"
                  autofocus
                  class="w-full"
                  :disabled="loading"
                />
              </UFormField>

              <UAlert v-if="error" color="error" :title="error" />

              <UButton
                type="submit"
                class="w-full justify-center"
                :loading="loading"
              >
                Sign in
              </UButton>
            </form>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()

const password = ref('')
const loading = ref(false)
const error = ref('')

async function login() {
  if (!password.value) return
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { password: password.value },
    })
    const redirect = (route.query.redirect as string) || '/'
    await router.push(redirect)
  } catch {
    error.value = 'Wrong password'
    password.value = ''
  } finally {
    loading.value = false
  }
}
</script>
