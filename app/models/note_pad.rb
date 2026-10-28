class NotePad < ApplicationRecord
  belongs_to :user

  before_create :set_position

  scope :ordered, -> { order(:position) }

  private

  # new pads go to the end of their owner's list
  def set_position
    self.position = (user.note_pads.maximum(:position) || -1) + 1
  end
end
