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
import { useTeamsStore } from '@/store/useTeamsStore'
import { Input } from '../ui/input'
import { PlayerPosition } from '@/interfaces/Player.interface'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function PlayerForm() {
  const { addPlayer } = useTeamsStore()

  const playerFormSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    position: z.string().min(1, 'required'),
  })

  const form = useForm({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      name: '',
      position: '',
    },
  })

  function onSubmit(formData: z.infer<typeof playerFormSchema>) {
    // Split the player names by comma and capitalize the first letter of each name
    const namesSeparatedByComma = formData.name
      ?.split(',')
      ?.map((name: string) => capitalizeFirstLetter(name.trim()))
    const { name, position } = formData
    if (name && position)
      addPlayer({ name, position: position as PlayerPosition })
    form.reset()
  }

  const positions = ['defender', 'midfielder', 'forward']

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-2"
      >
        {/* <FormField
          control={form.control}
          name="names"
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
        /> */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder="Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="position"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a verified email to display" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {positions.map(position => (
                      <SelectItem value={position}>{position}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Add player(s)</Button>
      </form>
    </Form>
  )
}
