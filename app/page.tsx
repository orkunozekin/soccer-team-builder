'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { capitalizeFirstLetter } from '@/lib/stringUtils'
import { usePlayersStore } from '@/store/usePlayerStore'
import AllPlayersScrollArea from '@/components/all-players/AllPlayersScrollArea'

export default function Home() {
  const { players, addPlayers, clearPlayers } = usePlayersStore()

  const playerFormSchema = z.object({
    playerNames: z.string().min(1, 'Add some players'),
  })

  const form = useForm({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      playerNames: '',
    },
  })

  function onSubmit(formData: z.infer<typeof playerFormSchema>) {
    // Split the player names by comma and capitalize the first letter of each name
    const namesSeparatedByComma = formData.playerNames
      ?.split(',')
      ?.map((name: string) => capitalizeFirstLetter(name.trim()))

    if (namesSeparatedByComma?.length > 0) {
      addPlayers(namesSeparatedByComma)
    }
    form.reset()
  }

  const handleEditUser = (id: string) => {}

  return (
    <section>
      <header className="mb-4 flex items-center justify-center bg-red-50 py-2 font-semibold text-white">
        Pickup Soccer Team Builder
      </header>
      <section className="flex flex-col gap-2 px-4">
        <p>Add player name(s) below to quickly form randomized teams</p>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-2"
          >
            <FormField
              control={form.control}
              name="playerNames"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Player name(s) separated by a comma"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Add player(s)</Button>
          </form>
        </Form>
        <AllPlayersScrollArea />
      </section>
    </section>
  )
}
