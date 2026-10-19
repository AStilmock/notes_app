class CreateNotePads < ActiveRecord::Migration[8.1]
  def change
    create_table :note_pads do |t|
      t.string :title, null: false, default: "Untitled"
      t.text :body
      t.integer :position, null: false, default: 0

      t.timestamps
    end
    add_index :note_pads, :position
  end
end
