<template>
	<slot :num="123"></slot>
	<slot name="named-slot" str="str"></slot>
	<slot name="vbind" v-bind="{ num: 123, str: 'str' }"></slot>
</template>

<script setup lang="ts">
</script>
