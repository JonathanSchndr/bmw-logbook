<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Vehicles</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ vehicles.length }} vehicle{{ vehicles.length !== 1 ? 's' : '' }} registered</p>
      </div>
      <div class="flex items-center gap-3">
        <UButton icon="i-heroicons-arrow-path" variant="outline" size="sm" :loading="syncing" @click="syncFromBmw">
          Sync from BMW
        </UButton>
        <UButton icon="i-heroicons-plus" size="sm" @click="showAddModal = true">
          Add manually
        </UButton>
      </div>
    </div>

    <!-- Vehicles Grid -->
    <div v-if="loading" class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      <USkeleton v-for="i in 3" :key="i" class="h-48 rounded-xl" />
    </div>

    <div
      v-else-if="vehicles.length === 0"
      class="text-center py-16 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800"
    >
      <UIcon name="i-mdi-car" class="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No vehicles</h3>
      <p class="text-gray-500 dark:text-gray-400 mb-4">
        Add your BMW vehicle to start recording trips
      </p>
      <div class="flex justify-center gap-3">
        <UButton icon="i-heroicons-arrow-path" variant="outline" @click="syncFromBmw">
          Load from BMW API
        </UButton>
        <UButton icon="i-heroicons-plus" @click="showAddModal = true">
          Add manually
        </UButton>
      </div>
    </div>

    <div v-else class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      <UCard v-for="vehicle in vehicles" :key="vehicle.vin" class="overflow-hidden">
        <div class="h-32 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 flex items-center justify-center mb-4 -mx-4 -mt-4">
          <img
            v-if="vehicle.imageUrl"
            :src="vehicle.imageUrl"
            :alt="`${vehicle.make} ${vehicle.model}`"
            class="max-h-28 object-contain"
          />
          <UIcon v-else name="i-mdi-car" class="h-16 w-16 text-blue-300 dark:text-blue-700" />
        </div>

        <div class="space-y-2">
          <div class="flex items-start justify-between">
            <div>
              <h3 class="font-bold text-gray-900 dark:text-white">
                {{ vehicle.make }} {{ vehicle.model }}
                <span v-if="vehicle.year" class="font-normal text-gray-500">({{ vehicle.year }})</span>
              </h3>
              <p v-if="vehicle.licensePlate" class="text-sm font-medium text-blue-600 dark:text-blue-400 mt-0.5">
                {{ vehicle.licensePlate }}
              </p>
            </div>
            <UBadge :color="vehicle.isActive ? 'green' : 'gray'" size="xs">
              {{ vehicle.isActive ? 'Active' : 'Inactive' }}
            </UBadge>
          </div>

          <div class="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            <p class="font-mono">VIN: {{ vehicle.vin }}</p>
            <p v-if="vehicle.color">Color: {{ vehicle.color }}</p>
            <p v-if="vehicle.mqttTopic" class="truncate">MQTT: {{ vehicle.mqttTopic }}</p>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-between items-center">
            <UButton variant="ghost" size="xs" icon="i-heroicons-pencil" @click="editVehicle(vehicle)">
              Edit
            </UButton>
            <UButton variant="ghost" size="xs" color="red" icon="i-heroicons-trash" @click="confirmDeleteVehicle(vehicle)" />
          </div>
        </template>
      </UCard>
    </div>

    <!-- BMW Mappings Modal -->
    <UModal v-model:open="showMappingsModal" scrollable :ui="{ content: 'sm:max-w-2xl' }">
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">Load vehicles from BMW API</h3>
          </template>

          <div v-if="mappingsLoading" class="py-8 flex justify-center">
            <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-blue-500" />
          </div>

          <div v-else-if="bmwMappings.length === 0" class="text-center py-6 text-gray-500">
            No vehicles found. Make sure you are connected to the BMW API.
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="mapping in bmwMappings"
              :key="mapping.vin"
              class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div>
                <p class="font-medium text-gray-900 dark:text-white">
                  {{ mapping.brand }} {{ mapping.modelName }}
                  <span v-if="mapping.year" class="font-normal text-gray-500">({{ mapping.year }})</span>
                </p>
                <p class="text-xs font-mono text-gray-500">{{ mapping.vin }}</p>
                <p v-if="mapping.licensePlate" class="text-xs text-gray-500">{{ mapping.licensePlate }}</p>
              </div>
              <UButton
                size="sm"
                :disabled="vehicleExists(mapping.vin)"
                :label="vehicleExists(mapping.vin) ? 'Already added' : 'Add vehicle'"
                @click="importVehicle(mapping)"
              />
            </div>
          </div>

          <template #footer>
            <UButton variant="ghost" @click="showMappingsModal = false">Close</UButton>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Add/Edit Vehicle Modal -->
    <UModal v-model:open="showAddModal" scrollable>
      <template #content>
        <UCard>
          <template #header>
            <h3 class="text-lg font-semibold">{{ editingVehicle ? 'Edit vehicle' : 'Add vehicle' }}</h3>
          </template>

          <form class="space-y-4" @submit.prevent="submitVehicle">
            <UFormField label="VIN" required class="w-full">
              <UInput v-model="vehicleForm.vin" placeholder="WBA1234567890" :disabled="!!editingVehicle" class="w-full font-mono" />
            </UFormField>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="License plate" class="w-full">
                <UInput v-model="vehicleForm.licensePlate" placeholder="M-AB 1234" class="w-full" />
              </UFormField>
              <UFormField label="Year" class="w-full">
                <UInput v-model="vehicleForm.year" type="number" placeholder="2023" class="w-full" />
              </UFormField>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Make" class="w-full">
                <UInput v-model="vehicleForm.make" placeholder="BMW" class="w-full" />
              </UFormField>
              <UFormField label="Model" class="w-full">
                <UInput v-model="vehicleForm.model" placeholder="5 Series G60" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Color" class="w-full">
              <UInput v-model="vehicleForm.color" placeholder="Alpine White" class="w-full" />
            </UFormField>
            <UFormField label="MQTT Topic" class="w-full">
              <UInput v-model="vehicleForm.mqttTopic" placeholder="gcid123/VIN..." class="w-full font-mono text-sm" />
              <template #hint>
                <span class="text-xs text-gray-500">Vehicle-specific MQTT topic from the BMW customer portal</span>
              </template>
            </UFormField>
          </form>

          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" @click="closeModal">Cancel</UButton>
              <UButton :loading="submitting" @click="submitVehicle">
                {{ editingVehicle ? 'Update' : 'Add vehicle' }}
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <!-- Delete confirmation -->
    <UModal v-model:open="showDeleteModal" scrollable>
      <template #content>
        <UCard>
          <template #header>
            <h3 class="font-semibold text-red-600">Delete vehicle?</h3>
          </template>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete <strong>{{ deletingVehicle?.licensePlate || deletingVehicle?.vin }}</strong>?
            All associated trips will be kept.
          </p>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="ghost" @click="showDeleteModal = false">Cancel</UButton>
              <UButton color="red" :loading="deleting" @click="doDeleteVehicle">Delete</UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Vehicle } from '~/types'

const toast = useToast()

const { data: vehiclesData, refresh: refreshVehicles } = await useFetch<Vehicle[]>('/api/vehicles')
const vehicles = computed(() => vehiclesData.value || [])
const loading = ref(false)

function vehicleExists(vin: string): boolean {
  return vehicles.value.some(v => v.vin === vin)
}

const syncing = ref(false)
const showMappingsModal = ref(false)
const mappingsLoading = ref(false)
const bmwMappings = ref<any[]>([])

async function syncFromBmw() {
  syncing.value = true
  mappingsLoading.value = true
  showMappingsModal.value = true
  try {
    const result = await $fetch<{ mappings: any[] }>('/api/vehicles/bmw-mappings')
    bmwMappings.value = result.mappings
  } catch (err: any) {
    toast.add({ title: 'Error loading mappings: ' + err.message, color: 'red' })
    showMappingsModal.value = false
  } finally {
    syncing.value = false
    mappingsLoading.value = false
  }
}

async function importVehicle(mapping: any) {
  try {
    await $fetch('/api/vehicles', {
      method: 'POST',
      body: {
        vin: mapping.vin,
        make: mapping.brand || 'BMW',
        model: mapping.modelName || '',
        year: mapping.year || null,
        licensePlate: mapping.licensePlate || '',
        mqttTopic: mapping.mqttTopic || '',
      },
    })
    await refreshVehicles()
    toast.add({ title: 'Vehicle added', color: 'green' })
  } catch (err: any) {
    toast.add({ title: 'Error: ' + err.message, color: 'red' })
  }
}

const showAddModal = ref(false)
const editingVehicle = ref<Vehicle | null>(null)
const submitting = ref(false)
const vehicleForm = reactive({
  vin: '',
  licensePlate: '',
  make: 'BMW',
  model: '',
  year: '',
  color: '',
  mqttTopic: '',
})

function editVehicle(v: Vehicle) {
  editingVehicle.value = v
  vehicleForm.vin = v.vin
  vehicleForm.licensePlate = v.licensePlate || ''
  vehicleForm.make = v.make || 'BMW'
  vehicleForm.model = v.model || ''
  vehicleForm.year = v.year ? String(v.year) : ''
  vehicleForm.color = v.color || ''
  vehicleForm.mqttTopic = v.mqttTopic || ''
  showAddModal.value = true
}

function closeModal() {
  showAddModal.value = false
  editingVehicle.value = null
  Object.assign(vehicleForm, { vin: '', licensePlate: '', make: 'BMW', model: '', year: '', color: '', mqttTopic: '' })
}

async function submitVehicle() {
  if (!vehicleForm.vin) {
    toast.add({ title: 'VIN is required', color: 'red' })
    return
  }
  submitting.value = true
  try {
    const body = {
      licensePlate: vehicleForm.licensePlate,
      make: vehicleForm.make,
      model: vehicleForm.model,
      year: vehicleForm.year ? parseInt(vehicleForm.year) : undefined,
      color: vehicleForm.color,
      mqttTopic: vehicleForm.mqttTopic,
    }
    if (editingVehicle.value) {
      await $fetch(`/api/vehicles/${vehicleForm.vin}`, { method: 'PATCH' as any, body })
      toast.add({ title: 'Vehicle updated', color: 'green' })
    } else {
      await $fetch('/api/vehicles', { method: 'POST', body: { ...body, vin: vehicleForm.vin } })
      toast.add({ title: 'Vehicle added', color: 'green' })
    }
    await refreshVehicles()
    closeModal()
  } catch (err: any) {
    toast.add({ title: 'Error: ' + err.message, color: 'red' })
  } finally {
    submitting.value = false
  }
}

const showDeleteModal = ref(false)
const deletingVehicle = ref<Vehicle | null>(null)
const deleting = ref(false)

function confirmDeleteVehicle(v: Vehicle) {
  deletingVehicle.value = v
  showDeleteModal.value = true
}

async function doDeleteVehicle() {
  if (!deletingVehicle.value) return
  deleting.value = true
  try {
    await $fetch(`/api/vehicles/${deletingVehicle.value.vin}`, { method: 'DELETE' as any })
    await refreshVehicles()
    toast.add({ title: 'Vehicle deleted', color: 'green' })
    showDeleteModal.value = false
  } catch (err: any) {
    toast.add({ title: 'Error: ' + err.message, color: 'red' })
  } finally {
    deleting.value = false
  }
}
</script>
