<template>
  <div>
    <div>
      <BaseDialog
        v-model="madeThisDialog"
        :icon="$globals.icons.chefHat"
        :title="$tc('recipe.made-this')"
        :submit-text="$tc('general.save')"
        @submit="createTimelineEvent"
        >
        <v-card-text>
          <v-form ref="domMadeThisForm">
            <v-textarea
              v-model="newTimelineEvent.eventMessage"
              autofocus
              :label="$tc('recipe.comment')"
              :hint="$tc('recipe.how-did-it-turn-out')"
              persistent-hint
              rows="4"
            ></v-textarea>
            <v-container>
              <v-row>
                <v-col cols="auto">
                  <v-menu
                    v-model="datePickerMenu"
                    :close-on-content-click="false"
                    transition="scale-transition"
                    offset-y
                    max-width="290px"
                    min-width="auto"
                  >
                    <template #activator="{ on, attrs }">
                      <v-text-field
                        v-model="newTimelineEventTimestamp"
                        :prepend-icon="$globals.icons.calendar"
                        v-bind="attrs"
                        readonly
                        v-on="on"
                      ></v-text-field>
                    </template>
                    <v-date-picker
                      v-model="newTimelineEventTimestamp"
                      no-title
                      :local="$i18n.locale"
                      @input="datePickerMenu = false"
                    />
                  </v-menu>
                </v-col>
                <v-spacer />
                <v-col cols="auto" align-self="center">
                  <AppButtonUpload
                    class="ml-auto"
                    url="none"
                    file-name="image"
                    accept="image/*"
                    :text="$i18n.tc('recipe.upload-image')"
                    :text-btn="false"
                    :post="false"
                    @uploaded="uploadImage"
                  />
                </v-col>
              </v-row>
            </v-container>
          </v-form>
        </v-card-text>
      </BaseDialog>
    </div>
    <div>
      <div class="d-flex justify-center flex-wrap">
        <BaseButton :small="$vuetify.breakpoint.smAndDown" @click="madeThisDialog = true">
          <template #icon> {{ $globals.icons.chefHat }} </template>
          {{ $t('recipe.made-this') }}
        </BaseButton>
      </div>
      <div class="d-flex justify-center flex-wrap">
        <v-chip
          label
          :small="$vuetify.breakpoint.smAndDown"
          color="accent custom-transparent"
          class="ma-1 pa-3"
        >
          <v-icon left>
            {{ $globals.icons.calendar }}
          </v-icon>
            {{ $t('recipe.last-made-date', { date: value ? new Date(value+"Z").toLocaleDateString($i18n.locale) : $t("general.never") } ) }}
        </v-chip>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, reactive, ref, toRefs, useContext } from "@nuxtjs/composition-api";
import { whenever } from "@vueuse/core";
import { VForm } from "~/types/vuetify";
import { useUserApi } from "~/composables/api";
import { Recipe, RecipeTimelineEventIn } from "~/lib/api/types/recipe";

export default defineComponent({
  props: {
    value: {
      type: String,
      default: null,
    },
    recipe: {
      type: Object as () => Recipe,
      default: null,
    },
  },
  setup(props, context) {
    const madeThisDialog = ref(false);
    const userApi = useUserApi();
    const { $auth, i18n } = useContext();
    const domMadeThisForm = ref<VForm>();
    const newTimelineEvent = ref<RecipeTimelineEventIn>({
      // @ts-expect-error - TS doesn't like the $auth global user attribute
      subject: i18n.t("recipe.user-made-this", { user: $auth.user.fullName } as string),
      eventType: "comment",
      eventMessage: "",
      timestamp: undefined,
      recipeId: props.recipe?.id || "",
    });
    const newTimelineEventImage = ref<File>();
    const newTimelineEventTimestamp = ref<string>();

    whenever(
      () => madeThisDialog.value,
      () => {
        // Set timestamp to now
        newTimelineEventTimestamp.value = (
          new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000)
        ).toISOString().substring(0, 10);
      }
    );

    function uploadImage(fileObject: File) {
      newTimelineEventImage.value = fileObject;
    }

    const state = reactive({datePickerMenu: false});
    async function createTimelineEvent() {
      if (!(newTimelineEventTimestamp.value && props.recipe?.id && props.recipe?.slug)) {
        return;
      }

      newTimelineEvent.value.recipeId = props.recipe.id

      // the user only selects the date, so we set the time to end of day local time
      // we choose the end of day so it always comes after "new recipe" events
      newTimelineEvent.value.timestamp = new Date(newTimelineEventTimestamp.value + "T23:59:59").toISOString();

      const eventResponse = await userApi.recipes.createTimelineEvent(newTimelineEvent.value);
      const newEvent = eventResponse.data;

      // we also update the recipe's last made value
      if (!props.value || newTimelineEvent.value.timestamp > props.value) {
        await userApi.recipes.updateLastMade(props.recipe.slug,  newTimelineEvent.value.timestamp);

        // update recipe in parent so the user can see it
        // we remove the trailing "Z" since this is how the API returns it
        context.emit(
          "input", newTimelineEvent.value.timestamp
            .substring(0, newTimelineEvent.value.timestamp.length - 1)
        );
      }

      // update the image, if provided
      if (newTimelineEventImage.value && newEvent) {
        const imageResponse = await userApi.recipes.updateTimelineEventImage(newEvent.id, newTimelineEventImage.value);
        if (imageResponse.data) {
          // @ts-ignore the image response data will always match a value of TimelineEventImage
          newEvent.image = imageResponse.data.image;
        }
      }

      // reset form
      newTimelineEvent.value.eventMessage = "";
      newTimelineEvent.value.timestamp = undefined;
      newTimelineEventImage.value = undefined;
      madeThisDialog.value = false;
      domMadeThisForm.value?.reset();

      context.emit("eventCreated", newEvent);
    }

    return {
      ...toRefs(state),
      domMadeThisForm,
      madeThisDialog,
      newTimelineEvent,
      newTimelineEventImage,
      newTimelineEventTimestamp,
      createTimelineEvent,
      uploadImage,
    };
  },
});
</script>
